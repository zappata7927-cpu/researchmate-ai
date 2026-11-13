/**
 * ResearchMate AI — AI provider abstraction (server-side only).
 *
 * Supported providers, in order of precedence:
 *  1. Any OpenAI-compatible API via env:
 *     AI_BASE_URL (e.g. https://api.openai.com/v1 , https://api.z.ai/api/paas/v4 , http://localhost:11434/v1)
 *     AI_API_KEY
 *     AI_MODEL    (e.g. gpt-4o , glm-4.6 , llama3)
 *  2. z-ai-web-dev-sdk (bundled, zero-config in Z.ai environments)
 *
 * The app NEVER calls AI from the client. All calls happen in API routes.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface AIResult {
  content: string;
  provider: string;
  model: string;
}

export class AIConfigError extends Error {
  constructor(message = "سرویس هوش مصنوعی پیکربندی نشده است.") {
    super(message);
    this.name = "AIConfigError";
  }
}

function env(k: string): string | undefined {
  const v = process.env[k];
  return v && v.trim() ? v.trim() : undefined;
}

export function aiStatus(): { configured: boolean; provider: string; model: string } {
  const baseUrl = env("AI_BASE_URL");
  const apiKey = env("AI_API_KEY");
  const model = env("AI_MODEL");
  if (baseUrl && apiKey) {
    return { configured: true, provider: "openai-compatible", model: model || "default" };
  }
  try {
    // z-ai-web-dev-sdk is bundled; available in Z.ai runtime without extra config
    require.resolve("z-ai-web-dev-sdk");
    return { configured: true, provider: "z-ai-sdk", model: "glm" };
  } catch {
    return { configured: false, provider: "none", model: "none" };
  }
}

let sdkPromise: Promise<any> | null = null;
async function getZAI(): Promise<any> {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      const mod = await import("z-ai-web-dev-sdk");
      const ZAI = (mod as any).default ?? mod;
      return await ZAI.create();
    })();
  }
  return sdkPromise;
}

/** Hard ceiling for a single AI call. Prevents a stalled upstream from
 * hanging a request until an intermediary proxy kills it with 502. */
const AI_CALL_TIMEOUT_MS = Number(env("AI_CALL_TIMEOUT_MS")) || 300000;

function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  let timer: any;
  const gate = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            `${label} بیش از ${Math.round(AI_CALL_TIMEOUT_MS / 1000)} ثانیه طول کشید. اتصال شبکه/سرویس هوش مصنوعی را بررسی کرده و دوباره تلاش کنید.`
          )
        ),
      AI_CALL_TIMEOUT_MS
    );
  });
  return Promise.race([p, gate]).finally(() => clearTimeout(timer));
}

async function chatOpenAICompatible(messages: ChatMessage[]): Promise<AIResult> {
  const baseUrl = env("AI_BASE_URL")!;
  const apiKey = env("AI_API_KEY")!;
  const model = env("AI_MODEL") || "gpt-4o";
  const url = baseUrl.replace(/\/+$/, "") + "/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 8192,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`خطای سرویس هوش مصنوعی (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("پاسخ خالی از سرویس هوش مصنوعی دریافت شد.");
  return { content, provider: "openai-compatible", model };
}

async function chatZAI(messages: ChatMessage[]): Promise<AIResult> {
  try {
    const zai = await getZAI();
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: "disabled" },
      max_tokens: 8192,
    });
    const content: string | undefined = completion?.choices?.[0]?.message?.content;
    if (!content) throw new Error("پاسخ خالی از سرویس هوش مصنوعی دریافت شد.");
    return { content, provider: "z-ai-sdk", model: "glm" };
  } catch (e: any) {
    // If SDK exists but fails at runtime (e.g. missing credentials), surface a clear message.
    if (String(e?.message || "").includes("API key")) {
      throw new AIConfigError(
        "سرویس هوش مصنوعی نیازمند کلید API است. در فایل .env مقادیر AI_BASE_URL و AI_API_KEY و AI_MODEL را تنظیم کنید."
      );
    }
    throw e;
  }
}

export async function chat(messages: ChatMessage[]): Promise<AIResult> {
  const status = aiStatus();
  if (!status.configured) throw new AIConfigError();
  const label = "فراخوانی سرویس هوش مصنوعی";
  if (status.provider === "openai-compatible") return withTimeout(chatOpenAICompatible(messages), label);
  return withTimeout(chatZAI(messages), label);
}

/** Repair common JSON problems from LLM output: keys missing their closing
 * quote, control chars in strings, trailing commas, and truncation. */
export function repairJSON(text: string): string {
  let t = text.trim();
  // 1) fix malformed keys FIRST (before any state tracking, because a missing
  //    closing quote flips string parity for the rest of the document):
  //    "key:  ->  "key":   (opening quote, identifier, colon — no closing quote)
  t = t.replace(/"([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*/g, '"$1": ');
  t = t.replace(/'([A-Za-z_$][A-Za-z0-9_$]*)'\s*:\s*/g, '"$1": ');
  // 2) fix raw control characters inside string literals (walk char-by-char)
  let out = "";
  let inStr = false;
  let escape = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (escape) {
        out += ch;
        escape = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        escape = true;
        continue;
      }
      if (ch === '"') {
        inStr = false;
        out += ch;
        continue;
      }
      if (ch === "\n") {
        out += "\\n";
        continue;
      }
      if (ch === "\r") continue;
      if (ch === "\t") {
        out += "\\t";
        continue;
      }
      out += ch;
    } else {
      if (ch === '"') inStr = true;
      out += ch;
    }
  }
  t = out;
  // 3) remove trailing commas before } or ]
  t = t.replace(/,\s*([}\]])/g, "$1");
  const tryParse = (s: string) => {
    try {
      JSON.parse(s);
      return true;
    } catch {
      return false;
    }
  };
  if (!tryParse(t)) {
    // 3) truncation repair: close open strings/brackets
    let inStr2 = false;
    let esc2 = false;
    const stack: string[] = [];
    for (const ch of t) {
      if (inStr2) {
        if (esc2) esc2 = false;
        else if (ch === "\\") esc2 = true;
        else if (ch === '"') inStr2 = false;
        continue;
      }
      if (ch === '"') inStr2 = true;
      else if (ch === "{" || ch === "[") stack.push(ch);
      else if (ch === "}" || ch === "]") stack.pop();
    }
    if (inStr2) t += '"';
    t = t.replace(/,\s*(?:"[^"]*"\s*:\s*)?$/, "");
    t = t.replace(/,\s*$/, "");
    while (stack.length) {
      const open = stack.pop();
      t += open === "{" ? "}" : "]";
    }
  }
  return t;
}

/** Extract the first JSON object/array from a model response (handles ```json fences). */
export function extractJSON(raw: string): any {
  let text = raw.trim();
  // strip markdown fences
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  // direct parse
  try {
    return JSON.parse(text);
  } catch {
    /* continue */
  }
  // find first { ... last }
  const start = text.search(/[{[]/);
  if (start >= 0) {
    const openChar = text[start];
    const closeChar = openChar === "{" ? "}" : "]";
    const end = text.lastIndexOf(closeChar);
    if (end > start) {
      const candidate = text.slice(start, end + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        /* continue */
      }
      try {
        return JSON.parse(repairJSON(candidate));
      } catch {
        /* continue */
      }
    }
  }
  try {
    return JSON.parse(repairJSON(text));
  } catch {
    throw new Error("خروجی هوش مصنوعی قابل تفسیر به‌صورت JSON نبود.");
  }
}

/** Robust JSON-mode chat: retries once with a "JSON only" reminder. */
export async function chatJSON<T>(
  system: string,
  user: string,
  validate: (data: any) => T,
  opts?: { maxChars?: number; retryNote?: string }
): Promise<{ data: T; meta: AIResult }> {
  const maxChars = opts?.maxChars ?? 60000;
  const userClipped = user.length > maxChars ? user.slice(0, maxChars) + "\n\n[متن به دلیل طول زیاد بریده شد — تحلیل بر همین بخش انجام شده است]" : user;
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: userClipped },
  ];
  let meta: AIResult;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      meta = await chat(messages);
      const data = validate(extractJSON(meta.content));
      return { data, meta };
    } catch (e: any) {
      lastErr = e;
      if (e instanceof AIConfigError) throw e;
      messages.push({ role: "assistant", content: "..." });
      messages.push({
        role: "user",
        content:
          (opts?.retryNote ||
            "پاسخ قبلی معتبر نبود. ") +
          "فقط و فقط یک شیء JSON معتبر مطابق ساختار خواسته‌شده برگردان. هیچ متن اضافه، توضیح یا بلوک کد ننویس.",
      });
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("خطای نامشخص در فراخوانی هوش مصنوعی");
}
