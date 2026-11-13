/**
 * ResearchMate AI — Document extraction engine (server-side).
 * Supports: PDF (unpdf), DOCX (mammoth), TXT/MD, RTF (basic), XLSX (summary).
 * DOC (legacy), images/OCR: explicitly reported as unsupported — never silently ignored.
 */

export interface ExtractionResult {
  text: string;
  pages: number | null;
  language: "fa" | "en" | "mixed";
  status: "ok" | "partial" | "failed" | "unsupported";
  notes: string;
}

export function detectLanguage(text: string): "fa" | "en" | "mixed" {
  const sample = text.slice(0, 5000);
  const persian = (sample.match(/[\u0600-\u06FF]/g) || []).length;
  const latin = (sample.match(/[A-Za-z]/g) || []).length;
  if (persian === 0 && latin === 0) return "en";
  const total = persian + latin;
  if (persian / total > 0.85) return "fa";
  if (persian / total < 0.15) return "en";
  return "mixed";
}

function stripRtf(rtf: string): string {
  // Very small RTF-to-text pass; adequate for proposals/manuscripts stored as RTF.
  let t = rtf
    .replace(/\\'([0-9a-fA-F]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u(-?\d+)\s?\??/g, (_m, d) => String.fromCharCode(Number(d) & 0xffff))
    .replace(/\{\\\*[^{}]*\}/g, "")
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\line\b/g, "\n")
    .replace(/\\tab\b/g, "\t")
    .replace(/\\[a-z]+-?\d*\s?/gi, "")
    .replace(/[{}]/g, "");
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

export async function extractDocument(
  filename: string,
  mime: string,
  buffer: Buffer
): Promise<ExtractionResult> {
  const lower = filename.toLowerCase();
  const notes: string[] = [];

  try {
    // ---------- PDF ----------
    if (lower.endsWith(".pdf") || mime === "application/pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const data = new Uint8Array(buffer);
      const pdf = await getDocumentProxy(data);
      const { text, totalPages } = await extractText(pdf, { mergePages: true });
      const pages = totalPages || pdf.numPages;
      const trimmed = text.replace(/\u0000/g, "").trim();
      if (trimmed.length < 80) {
        return {
          text: trimmed,
          pages,
          language: detectLanguage(trimmed),
          status: "failed",
          notes:
            "متن قابل استخراجی از این PDF یافت نشد. این فایل احتمالاً تصویری/اسکن‌شده است و نیازمند OCR است؛ در این نسخه OCR پشتیبانی نمی‌شود. لطفاً نسخه متنی (قابل انتخاب متن) بارگذاری کنید.",
        };
      }
      const scannedLike = /[\uFFFD]/.test(trimmed) || trimmed.length / Math.max(pages, 1) < 120;
      if (scannedLike) {
        notes.push(
          "متن استخراج‌شده از این PDF بسیار کم یا ناقص است؛ بخش‌هایی از سند (مثلاً جدول‌ها یا صفحات اسکن‌شده) ممکن است خوانده نشده باشد."
        );
      }
      return {
        text: trimmed,
        pages,
        language: detectLanguage(trimmed),
        status: notes.length ? "partial" : "ok",
        notes: notes.join(" "),
      };
    }

    // ---------- DOCX ----------
    if (lower.endsWith(".docx") || mime.includes("wordprocessingml")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      const text = (result.value || "").trim();
      if (text.length < 20) {
        return {
          text,
          pages: null,
          language: detectLanguage(text),
          status: "failed",
          notes: "متن معناداری از فایل DOCX استخراج نشد؛ فایل ممکن است خالی یا خراب باشد.",
        };
      }
      return { text, pages: null, language: detectLanguage(text), status: "ok", notes: "" };
    }

    // ---------- TXT / MD ----------
    if (lower.endsWith(".txt") || lower.endsWith(".md") || mime.startsWith("text/")) {
      const text = buffer.toString("utf8").trim();
      return {
        text,
        pages: null,
        language: detectLanguage(text),
        status: text.length > 20 ? "ok" : "failed",
        notes: text.length > 20 ? "" : "فایل متنی تقریباً خالی است.",
      };
    }

    // ---------- RTF ----------
    if (lower.endsWith(".rtf") || mime === "application/rtf") {
      const raw = buffer.toString("utf8");
      const text = stripRtf(raw);
      return {
        text,
        pages: null,
        language: detectLanguage(text),
        status: text.length > 20 ? "partial" : "failed",
        notes:
          text.length > 20
            ? "استخراج از RTF به‌صورت پایه انجام شده است؛ قالب‌بندی و جدول‌ها ممکن است کامل نباشد. برای دقت بیشتر فایل را به DOCX تبدیل کنید."
            : "استخراج RTF ناموفق بود؛ فایل را به DOCX یا PDF تبدیل کنید.",
      };
    }

    // ---------- XLSX (supplementary data) ----------
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || mime.includes("spreadsheet")) {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buffer, { type: "buffer" });
      const parts: string[] = [`[فایل داده مکمل: ${filename}]`];
      for (const name of wb.SheetNames.slice(0, 10)) {
        const sheet = wb.Sheets[name];
        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
        const head = rows.slice(0, 8).map((r) => r.slice(0, 12).join(" | "));
        parts.push(
          `\n## برگه «${name}» — ${rows.length} ردیف\nسرستون‌ها و نمونه ردیف‌ها:\n${head.join("\n")}`
        );
      }
      const text = parts.join("\n");
      return {
        text,
        pages: null,
        language: detectLanguage(text),
        status: "partial",
        notes:
          "از فایل داده مکمل فقط ساختار برگه‌ها و چند ردیف نمونه استخراج می‌شود؛ برای ممیزی آماری کامل، داده خام کامل لازم است.",
      };
    }

    // ---------- Unsupported (explicit, never silent) ----------
    const isDoc = lower.endsWith(".doc") || mime === "application/msword";
    const isImage = mime.startsWith("image/");
    return {
      text: "",
      pages: null,
      language: "en",
      status: "unsupported",
      notes: isDoc
        ? "قالب DOC قدیمی پشتیبانی نمی‌شود. لطفاً فایل را در Word به DOCX تبدیل و دوباره بارگذاری کنید."
        : isImage
          ? "پردازش تصویر (OCR) در این نسخه فعال نیست. لطفاً متن قابل انتخاب (PDF/DOCX) بارگذاری کنید."
          : "قالب فایل پشتیبانی نمی‌شود. قالب‌های پشتیبانی‌شده: PDF، DOCX، TXT، MD، RTF، XLSX.",
    };
  } catch (e: any) {
    return {
      text: "",
      pages: null,
      language: "en",
      status: "failed",
      notes: `خطا در پردازش فایل: ${String(e?.message || e).slice(0, 200)}`,
    };
  }
}

/** Heuristic (non-AI) document type guess, combined later with AI classification. */
export function heuristicClassify(text: string): { docType: string; language: "fa" | "en" | "mixed" } {
  const t = (text || "").slice(0, 20000);
  const has = (...words: string[]) => words.some((w) => t.toLowerCase().includes(w));
  let docType = "other";
  let score: Record<string, number> = {
    proposal: 0,
    manuscript: 0,
    protocol: 0,
    systematic_review: 0,
    case_report: 0,
  };
  if (has("پروپوزال", "پیشنهاد پژوهشی", "طرح پژوهشی", "research proposal", "proposal")) score.proposal += 3;
  if (has("بیان مسئله", "ضرورت پژوهش", "اهداف پژوهش", "فرضیه‌های پژوهش", "اهداف تحقیق")) score.proposal += 2;
  if (has("جدول زمان‌بندی", "گانت", "بودجه پژوهش", "فهرست منابع مالی")) score.proposal += 2;
  if (has("مقاله", "manuscript", "abstract", "چکیده", "keywords", "کلیدواژه")) score.manuscript += 2;
  if (has("introduction", "methods", "results", "discussion", "مقدمه", "روش کار", "یافته‌ها", "بحث و نتیجه‌گیری")) score.manuscript += 2;
  if (has("کارآزمایی بالینی", "clinical trial", "randomized", "تصادفی‌سازی")) score.manuscript += 1;
  if (has("پروتکل مطالعه", "study protocol", "trial protocol", "پروتکل کارآزمایی")) score.protocol += 4;
  if (has("مرور نظام‌مند", "systematic review", "متاآنالیز", "meta-analysis", "prisma")) score.systematic_review += 4;
  if (has("گزارش مورد", "case report", "we report a case", "معرفی پرونده")) score.case_report += 4;
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= 2) docType = best[0];
  return { docType, language: detectLanguage(text || "") };
}
