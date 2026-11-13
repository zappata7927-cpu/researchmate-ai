import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildDocxReport } from "@/lib/docx-export";
import { scoreReview } from "@/lib/scoring";
import { rubricFor, DEFAULT_STATS_RUBRIC } from "@/lib/rubrics";
import { DOC_TYPE_FA } from "@/lib/labels";
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";

export const runtime = "nodejs";
export const maxDuration = 300;

const DISCLAIMERS = [
  "این گزارش به‌وسیله هوش مصنوعی تولید شده است و جایگزین داوری انسانی مجاز، کمیته اخلاق یا تصمیم هیئت تحریریه نیست.",
  "«غیرقابل ارزیابی» به معنای در دسترس نبودن اطلاعات لازم در سند است، نه امتیاز صفر.",
  "راستی‌آزمایی منابع بر اساس متادیتای عمومی Crossref/OpenAlex/PubMed انجام شده است؛ «یافت‌نشدن» به معنای وجود نداشتن سند نیست.",
  "برای موارد نیازمند داده خام، استنباط قطعی آماری بدون دسترسی به داده‌های اولیه امکان‌پذیر نیست.",
  "محتوای محرمانه سند شما فقط برای تولید همین گزارش پردازش شده و برای آموزش مدل‌ها استفاده نمی‌شود.",
];

function buildResponseLetterDocx(letter: any, projectTitle: string): Promise<Buffer> {
  const P2 = Paragraph;
  const rtl = (t: string, o: any = {}) =>
    new TextRun({ text: t, rightToLeft: true, bold: o.bold, size: o.size ?? 22, color: o.color ?? "111827", font: "Vazirmatn" });
  const p = (t: string, o: any = {}) =>
    new P2({ bidirectional: true, alignment: AlignmentType.RIGHT, spacing: { after: 120, line: 320 }, children: [rtl(t, o)] });
  const children: any[] = [
    new P2({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [rtl("پاسخ نویسندگان به داوران", { bold: true, size: 32, color: "0E2A47" })] }),
    p(`عنوان مقاله: ${projectTitle}`),
    p(letter?.preamble || ""),
  ];
  (letter?.responses || []).forEach((r: any, i: number) => {
    children.push(new P2({ bidirectional: true, alignment: AlignmentType.RIGHT, spacing: { before: 220, after: 80 }, children: [rtl(`نظر ${i + 1}: ${r.comment}`, { bold: true })] }));
    children.push(p(`پاسخ: ${r.response}`));
    if (r.changesMade) children.push(p(`تغییرات انجام‌شده: ${r.changesMade}`));
    children.push(p(`محل تغییر: ${r.location || "(صفحه/سطر پس از نهایی‌سازی تعیین شود)"}`, { color: "64748b", size: 20 }));
  });
  children.push(p("این نامه با دستیار بازنگری پژوهش‌یار هوشمند تولید شده است.", { color: "64748b", size: 19 }));
  const doc = new Document({ sections: [{ properties: {}, children }] });
  return Packer.toBuffer(doc).then((b) => Buffer.from(b));
}

// GET /api/projects/[id]/export?report=authors|editor|full|response_letter
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kind = (req.nextUrl.searchParams.get("report") || "full") as "authors" | "editor" | "full" | "response_letter";

  const project = await db.project.findUnique({
    where: { id },
    include: { documents: { orderBy: { createdAt: "asc" } }, reviews: { orderBy: { createdAt: "desc" } }, revisions: { orderBy: { createdAt: "desc" } } },
  });
  if (!project) return NextResponse.json({ error: "پروژه یافت نشد." }, { status: 404 });

  const getReview = (engine: string) => {
    const r = project.reviews.find((x) => x.engine === engine);
    return r ? JSON.parse(r.payload) : null;
  };

  if (kind === "response_letter") {
    const letter = getReview("response_letter");
    if (!letter) return NextResponse.json({ error: "ابتدا نامه پاسخ به داوران را تولید کنید." }, { status: 400 });
    const buf = await buildResponseLetterDocx(letter, project.title);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="response-letter-${id}.docx"`,
      },
    });
  }

  const reviewData = getReview("proposal") || getReview("manuscript");
  const classification = getReview("classification");
  const stats = getReview("stats");
  const references = getReview("references");
  const journal = getReview("journal");
  const reviewers = getReview("reviewers");
  const reports = getReview("reports");

  // rebuild score object
  let score = null as any;
  if (reviewData?.criteria) {
    const rubric = rubricFor(reviewData === reviewData ? (project.reviews.find((r) => r.engine === "proposal") ? "proposal" : "manuscript") : "proposal");
    score = reviewData.score || scoreReview(reviewData.criteria, rubric, reviewData.issues || []);
  } else if (stats?.criteria) {
    score = stats.score || scoreReview(stats.criteria, DEFAULT_STATS_RUBRIC, stats.issues || []);
  }

  const guideline = reviewData?.guideline ? { name: reviewData.guideline.name, complianceScore: reviewData.guideline.complianceScore, items: reviewData.guideline.items } : null;

  const buf = await buildDocxReport({
    projectTitle: project.title,
    docTypeLabel: DOC_TYPE_FA[project.docType] || project.docType + (classification?.design ? ` — ${classification.design}` : ""),
    generatedAt: new Date().toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" }),
    reportKind: kind as any,
    score,
    review: reviewData,
    guideline,
    stats,
    references,
    journal,
    reviewers,
    reports,
    revisions: project.revisions,
    disclaimers: DISCLAIMERS,
  });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="researchmate-report-${kind}-${id}.docx"`,
    },
  });
}
