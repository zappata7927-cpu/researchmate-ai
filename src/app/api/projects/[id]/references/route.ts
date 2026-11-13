import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AIConfigError } from "@/lib/ai";
import { extractReferencesAI, verifySingleReference } from "@/lib/engines/references";
import { runAsync } from "@/lib/jobs";
import type { Issue } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 600;

const MAX_VERIFY = 25; // honest cap, stated in summary

async function loadProject(id: string) {
  return db.project.findUnique({
    where: { id },
    include: { documents: { where: { kind: "main" } } },
  });
}

// POST /api/projects/[id]/references — extract + verify against real APIs
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const project = await loadProject(id);
  if (!project) return NextResponse.json({ error: "پروژه یافت نشد." }, { status: 404 });

  const text = project.documents
    .map((d) => d.text || "")
    .join("\n\n")
    .trim();
  if (!text) return NextResponse.json({ error: "متنی برای تحلیل وجود ندارد." }, { status: 400 });

  async function runReferencesTask(): Promise<{ engine: string; payload: any }> {
    try {
      await db.project.update({ where: { id }, data: { status: "analyzing", statusMessage: "استخراج فهرست منابع…" } });

      const extraction = await extractReferencesAI(text);
      const refs = (extraction.references || []).slice(0, MAX_VERIFY);
      const skipped = (extraction.totalFound || extraction.references?.length || 0) - refs.length;

      await db.project.update({
        where: { id },
        data: { status: "analyzing", statusMessage: `راستی‌آزمایی ${refs.length} منبع در پایگاه‌های Crossref/OpenAlex/PubMed…` },
      });

      const references: any[] = [];
      const batchSize = 5;
      for (let i = 0; i < refs.length; i += batchSize) {
        const batch = refs.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map((r) =>
            verifySingleReference({ raw: r.raw, title: r.title || undefined, authors: r.authors || undefined, journal: r.journal || undefined, year: r.year || undefined, doi: r.doi || undefined }).catch(() => null)
          )
        );
        batch.forEach((r, j) => references.push({ index: r.index || i + j + 1, raw: r.raw, relevance: "—", check: results[j] }));
      }

      // Deterministic, honest issue generation from verification statistics
      const issues: Issue[] = [];
      const cnt = { verified: 0, partial: 0, wrong_metadata: 0, doi_not_found: 0, possibly_retracted: 0, unverified: 0 };
      for (const r of references) {
        const s = r.check?.status as keyof typeof cnt | undefined;
        if (s && s in cnt) cnt[s]++;
      }
      if (cnt.possibly_retracted > 0) {
        issues.push({
          title: `${cnt.possibly_retracted} منبع دارای نشانگر بازنشانی (Retraction)`,
          category: "ethical" as const,
          severity: "critical" as const,
          location: "فهرست منابع",
          excerpt: "",
          explanation:
            "بر اساس متادیتای Crossref/OpenAlex، برای این منابع اعلان Retraction ثبت شده است. استناد به مقاله بازنشده‌شده بدون اشاره به وضعیت آن، خطر اعتبار علمی ایجاد می‌کند.",
          whyMatters: "استناد به مقاله بازنشده می‌تواند پایه استدلال‌ها و نتیجه‌گیری‌ها را بی‌اعتبار کند و توسط سردبیران به‌عنوان نشانه ضعف جست‌وجوی ادبیات دیده شود.",
          suggestion: "منبع را با گزینه جایگزین معتبر جایگزین کنید یا در صورت ضرورت استناد، صریحاً به بازنشده‌شدن آن اشاره کنید.",
          detailedSolution:
            "۱) شناسه‌های مشخص‌شده در جدول را بازبینی کنید. ۲) آخرین نسخه/اصلاحیه را در PubPeer/Retraction Watch بررسی کنید. ۳) منبع جایگزین معتبر معرفی و فهرست منابع را به‌روزرسانی کنید.",
          suggestedText: null,
          guideline: "COPE Ethical Guidelines",
        });
      }
      if (cnt.wrong_metadata > 0) {
        issues.push({
          title: `${cnt.wrong_metadata} منبع با متادیتای ناهمخوان`,
          category: "reference" as const,
          severity: "major" as const,
          location: "فهرست منابع",
          excerpt: "",
          explanation: "عنوان، نام مجله یا سال برخی منابع با متادیتای رسمی پایگاه‌های علمی هم‌خوانی ندارد.",
          whyMatters: "متادیتای نادرست نشانه دقت پایین در استناددهی است و ممکن است نشانه استناد از منابع ثانویه (بدون مراجعه به متن اصلی) باشد.",
          suggestion: "اطلاعات استناد را از صفحه رسمی ناشر/DOI اصلاح کنید.",
          detailedSolution: "برای هر شناسه در جدول، لینک یافت‌شده را باز کنید و اجزای استناد (نویسندگان، سال، مجله، جلد، صفحه‌ها، DOI) را با نسخه رسمی تطبیق دهید.",
          suggestedText: null,
          guideline: "ICMJE Recommendations",
        });
      }
      if (cnt.unverified > 0) {
        issues.push({
          title: `${cnt.unverified} منبع در پایگاه‌های علمی راستی‌آزمایی نشد`,
          category: "reference" as const,
          severity: "moderate" as const,
          location: "فهرست منابع",
          excerpt: "",
          explanation:
            "این منابع با تطابق کافی در Crossref، OpenAlex و PubMed یافت نشدند. «یافت‌نشدن» به‌معنای وجود نداشتن سند نیست؛ ممکن است کتاب، کنفرانس، سند غیرنمایه‌شده یا با متادیتای متفاوت باشند.",
          whyMatters: "لازم است نویسنده به‌صورت دستی صحت این منابع را تأیید کند تا از استنادهای ساختگی یا نادرست جلوگیری شود.",
          suggestion: "هر مورد را دستی در گوگل اسکالر/پایگاه ناشر بررسی و در صورت وجود خطا اصلاح کنید.",
          detailedSolution: "برای هر استناد: جست‌وجوی عنوان دقیق → بازبینی DOI/URL → اصلاح اجزای استناد یا حذف/جایگزینی منبع نامعتبر.",
          suggestedText: null,
          guideline: null,
        });
      }

      const summary =
        (extraction.summary ? extraction.summary + " " : "") +
        `از ${references.length} منبع بررسی‌شده: ${cnt.verified} تأییدشده، ${cnt.partial} تأیید جزئی، ${cnt.wrong_metadata} متادیتای ناهمخوان، ${cnt.possibly_retracted} احتمال بازنشانی، ${cnt.unverified} قابل راستی‌آزمایی نبود.` +
        (skipped > 0 ? ` (${skipped} منبع دیگر به‌دلیل سقف پردازش، بررسی نشد و باید دستی کنترل شود.)` : "");

      const payload = { summary, totalFound: extraction.totalFound || references.length, references, issues };
      await db.review.create({ data: { projectId: id, engine: "references", payload: JSON.stringify(payload) } });
      await db.project.update({ where: { id }, data: { status: "ready", statusMessage: null } });
      return { engine: "references", payload };
    } catch (e: any) {
      await db.project.update({ where: { id }, data: { status: "error", statusMessage: String(e?.message || e).slice(0, 300) } }).catch(() => null);
      throw e;
    }
  }

  if (body?.async === true) {
    const { jobId } = runAsync(() => runReferencesTask());
    return NextResponse.json({ jobId }, { status: 202 });
  }

  try {
    const result = await runReferencesTask();
    return NextResponse.json(result);
  } catch (e: any) {
    const status = e instanceof AIConfigError ? 503 : 500;
    return NextResponse.json({ error: String(e?.message || e).slice(0, 400) }, { status });
  }
}
