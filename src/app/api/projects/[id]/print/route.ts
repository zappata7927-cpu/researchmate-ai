import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildPrintHTML } from "@/lib/print-html";
import { DOC_TYPE_FA } from "@/lib/labels";

export const runtime = "nodejs";

const DISCLAIMERS = [
  "این گزارش به‌وسیله هوش مصنوعی تولید شده است و جایگزین داوری انسانی مجاز، کمیته اخلاق یا تصمیم هیئت تحریریه نیست.",
  "«غیرقابل ارزیابی» به معنای در دسترس نبودن اطلاعات لازم در سند است، نه امتیاز صفر.",
  "راستی‌آزمایی منابع بر اساس متادیتای عمومی Crossref/OpenAlex/PubMed انجام شده است؛ «یافت‌نشدن» به معنای وجود نداشتن سند نیست.",
  "برای موارد نیازمند داده خام، استنباط قطعی آماری بدون دسترسی به داده‌های اولیه امکان‌پذیر نیست.",
];

// GET /api/projects/[id]/print?report=authors|editor|full — printable HTML
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kind = (req.nextUrl.searchParams.get("report") || "full") as "authors" | "editor" | "full";

  const project = await db.project.findUnique({
    where: { id },
    include: { reviews: { orderBy: { createdAt: "desc" } } },
  });
  if (!project) return NextResponse.json({ error: "پروژه یافت نشد." }, { status: 404 });

  const getReview = (engine: string) => {
    const r = project.reviews.find((x) => x.engine === engine);
    return r ? JSON.parse(r.payload) : null;
  };

  const reviewData = getReview("proposal") || getReview("manuscript");
  const classification = getReview("classification");

  const html = buildPrintHTML({
    reportKind: kind,
    projectTitle: project.title,
    docTypeLabel:
      (DOC_TYPE_FA[project.docType] || project.docType) + (classification?.design ? ` — ${classification.design}` : ""),
    generatedAt: new Date().toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" }),
    score: reviewData?.score || (getReview("stats")?.score ? getReview("stats").score : null),
    review: reviewData,
    guideline: reviewData?.guideline || null,
    stats: getReview("stats"),
    references: getReview("references"),
    journal: getReview("journal"),
    reviewers: getReview("reviewers"),
    reports: getReview("reports"),
    disclaimers: DISCLAIMERS,
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
