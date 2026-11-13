/**
 * ResearchMate AI — DOCX report generation (server-side, full RTL).
 * Produces Report A (to authors), Report B (confidential to editor) or a
 * complete technical dossier including scores, issues, guideline compliance,
 * references verification and reviewer simulation.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";
import { RECOMMENDATION_FA, scoreBand } from "./scoring";
import type { ScoreResult } from "./scoring";

const NAVY = "0E2A47";
const TEAL = "0F766E";
const RED = "DC2626";
const ORANGE = "EA580C";
const AMBER = "D97706";
const SLATE = "475569";

function rtlText(text: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) {
  return new TextRun({
    text,
    rightToLeft: true,
    bold: opts.bold,
    italics: opts.italics,
    size: opts.size ?? 22, // half-points => 11pt
    color: opts.color ?? "111827",
    font: "Vazirmatn",
  });
}

function p(text: string, opts: { bold?: boolean; size?: number; color?: string; spacing?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: opts.align ?? AlignmentType.RIGHT,
    spacing: { after: opts.spacing ?? 120, line: 320 },
    children: [rtlText(text, opts)],
  });
}

function heading(text: string, level: 1 | 2 | 3 = 2, color = NAVY) {
  const sizes = { 1: 34, 2: 28, 3: 24 };
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: level === 1 ? 200 : 260, after: 140 },
    heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    border: level === 2 ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: TEAL, space: 4 } } : undefined,
    children: [rtlText(text, { bold: true, size: sizes[level], color })],
  });
}

function bullet(text: string, color = "111827") {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    bullet: { level: 0 },
    spacing: { after: 80, line: 300 },
    children: [rtlText(text, { size: 21, color })],
  });
}

function kvLine(k: string, v: string) {
  return p(`${k}: ${v}`, { size: 21, color: SLATE });
}

const SEVERITY_FA: Record<string, string> = {
  critical: "بحرانی",
  major: "اساسی (ماژور)",
  moderate: "متوسط",
  minor: "جزئی (مینور)",
};
const CATEGORY_FA: Record<string, string> = {
  methodological: "روش‌شناختی",
  statistical: "آماری",
  reasoning: "استدلال علمی",
  ethical: "اخلاقی",
  reporting: "گزارش‌دهی",
  reference: "منابع",
  language: "نگارش و ساختار",
  publication: "تناسب انتشار",
};

function issueBlock(issue: any, idx: number): Paragraph[] {
  const sevColor =
    issue.severity === "critical" ? RED : issue.severity === "major" ? ORANGE : issue.severity === "moderate" ? AMBER : SLATE;
  const parts: Paragraph[] = [];
  parts.push(
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      spacing: { before: 200, after: 60 },
      shading: { fill: "F1F5F9" },
      border: {
        right: { style: BorderStyle.SINGLE, size: 18, color: sevColor, space: 6 },
      },
      children: [
        rtlText(`ایراد ${idx}: ${issue.title}`, { bold: true, size: 23 }),
        rtlText(`  [${SEVERITY_FA[issue.severity] || issue.severity}]`, { bold: true, size: 21, color: sevColor }),
      ],
    })
  );
  parts.push(kvLine("دسته", CATEGORY_FA[issue.category] || issue.category));
  parts.push(kvLine("محل در سند", issue.location || "—"));
  if (issue.excerpt) parts.push(kvLine("نقل‌قول مرتبط", issue.excerpt));
  parts.push(kvLine("توضیح علمی", issue.explanation || "—"));
  parts.push(kvLine("چرا مهم است", issue.whyMatters || "—"));
  parts.push(kvLine("پیشنهاد اصلاح", issue.suggestion || "—"));
  parts.push(kvLine("راه‌حل عملی", issue.detailedSolution || "—"));
  if (issue.suggestedText) parts.push(kvLine("متن پیشنهادی جایگزین", issue.suggestedText));
  if (issue.guideline) parts.push(kvLine("استاندارد پشتیبان", issue.guideline));
  return parts;
}

function scoresTable(score: ScoreResult | null): Table | null {
  if (!score) return null;
  const header = new TableRow({
    children: ["معیار", "وزن", "امتیاز (از 5)", "نمره وزنی"].map(
      (h) =>
        new TableCell({
          children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, children: [rtlText(h, { bold: true, color: "FFFFFF", size: 20 })] })],
          shading: { fill: NAVY },
          width: { size: 25, type: WidthType.PERCENTAGE },
        })
    ),
  });
  const rows = score.perCriterion.map((c) => {
    const cells = [c.label, String(c.weight), c.score === null ? "غیرقابل ارزیابی" : String(c.score), c.weighted === null ? "—" : c.weighted.toFixed(1)];
    return new TableRow({
      children: cells.map(
        (v) =>
          new TableCell({
            children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, children: [rtlText(v, { size: 20 })] })],
          })
      ),
    });
  });
  return new Table({ rows: [header, ...rows], width: { size: 100, type: WidthType.PERCENTAGE } });
}

export interface ReportInput {
  projectTitle: string;
  docTypeLabel: string;
  generatedAt: string;
  reportKind: "authors" | "editor" | "full";
  score: ScoreResult | null;
  review: any; // proposal/manuscript review payload
  guideline?: { name: string; complianceScore?: number; items?: any[] } | null;
  stats?: any | null;
  references?: any | null;
  journal?: any | null;
  reviewers?: any | null;
  reports?: any | null;
  revisions?: any[];
  disclaimers: string[];
}

export async function buildDocxReport(input: ReportInput): Promise<Buffer> {
  const children: Paragraph[] = [];
  const { reportKind } = input;

  // ---------- Cover ----------
  children.push(
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      spacing: { before: 1400, after: 200 },
      children: [rtlText("پژوهش‌یار هوشمند", { bold: true, size: 52, color: NAVY })],
    }),
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      spacing: { after: 500 },
      children: [rtlText("ResearchMate AI — گزارش داوری علمی", { size: 26, color: TEAL })],
    }),
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [
        rtlText(
          reportKind === "authors" ? "گزارش A — نظرات برای نویسندگان" : reportKind === "editor" ? "گزارش B — نظرات محرمانه برای سردبیر" : "گزارش فنی جامع داوری",
          { bold: true, size: 30 }
        ),
      ],
    }),
    p(`عنوان سند: ${input.projectTitle}`, { align: AlignmentType.CENTER, size: 24 }),
    p(`نوع سند: ${input.docTypeLabel}`, { align: AlignmentType.CENTER, size: 22, color: SLATE }),
    p(`تاریخ تولید گزارش: ${input.generatedAt}`, { align: AlignmentType.CENTER, size: 22, color: SLATE }),
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      spacing: { before: 500, after: 60 },
      children: [rtlText("طراح و سازنده: سید مجتبی کاظمی", { bold: true, size: 24, color: NAVY })],
    }),
    p("عضو هیئت علمی گروه پرستاری، دانشکده علوم پزشکی بهبهان", { align: AlignmentType.CENTER, size: 21, color: SLATE })
  );
  children.push(new Paragraph({ text: "", pageBreakBefore: true }));

  // ---------- Disclaimers ----------
  children.push(heading("نکات مهم و محدودیت‌ها", 2, TEAL));
  for (const d of input.disclaimers) children.push(bullet(d, SLATE));

  // ---------- Full report: scores ----------
  if (reportKind === "full" && input.score) {
    children.push(heading("امتیاز کلی", 2));
    const band = scoreBand(input.score.total);
    children.push(
      p(
        `امتیاز کل: ${input.score.total === null ? "غیرقابل ارزیابی" : input.score.total + " از 100"} (${band.label}) — معیارهای قابل ارزیابی: ${input.score.assessable} از ${input.score.totalCriteria} — توصیه: ${RECOMMENDATION_FA[input.score.recommendation] || input.score.recommendation}`,
        { bold: true }
      )
    );
    if (input.score.hasCriticalProblem) {
      children.push(p("هشدار: حداقل یک مشکل بحرانی شناسایی شد؛ این مشکل مستقل از امتیاز کل باید برطرف شود.", { bold: true, color: RED }));
    }
    const st = input.score.counts;
    children.push(p(`تعداد ایرادها — بحرانی: ${st.critical} | اساسی: ${st.major} | متوسط: ${st.moderate} | جزئی: ${st.minor}`));
    const table = scoresTable(input.score);
    if (table) {
      children.push(new Paragraph({ text: "" }));
      children.push(table as any);
    }
  }

  // ---------- Review core ----------
  const review = input.review;
  if (reportKind !== "editor" && review) {
    children.push(heading("ارزیابی کلی داوری", 2));
    if (review.summary) children.push(p(review.summary));
    if (review.strengths?.length) {
      children.push(heading("نقاط قوت", 3, TEAL));
      review.strengths.forEach((s: string) => children.push(bullet(s)));
    }
    const issues: any[] = review.issues || [];
    const majors = issues.filter((i) => i.severity === "critical" || i.severity === "major");
    const minors = issues.filter((i) => i.severity === "moderate" || i.severity === "minor");
    if (majors.length) {
      children.push(heading("ایرادهای اساسی و بحرانی", 3, RED));
      majors.forEach((iss, i) => children.push(...issueBlock(iss, i + 1)));
    }
    if (minors.length) {
      children.push(heading("ایرادهای متوسط و جزئی", 3, AMBER));
      minors.forEach((iss, i) => children.push(...issueBlock(iss, i + 1)));
    }
    if (review.recommendationExplanation || review.overallRecommendation) {
      children.push(heading("توصیه نهایی داور", 3));
      children.push(p(`توصیه: ${RECOMMENDATION_FA[review.overallRecommendation] || review.overallRecommendation}`, { bold: true }));
      if (review.recommendationExplanation) children.push(p(review.recommendationExplanation));
    }
  }

  // ---------- Guideline compliance ----------
  if (reportKind === "full" && input.guideline?.items?.length) {
    children.push(heading(`تبعیت از راهنمای گزارش‌دهی — ${input.guideline.name}`, 2));
    children.push(p(`نمره تبعیت: ${input.guideline.complianceScore ?? "—"} از 100`));
    const STATUS_FA: Record<string, string> = { reported: "گزارش‌شده", partial: "ناقص", missing: "گزارش‌نشده", na: "غیرقابل ارزیابی" };
    const gh = new TableRow({
      children: ["آیتم چک‌لیست", "وضعیت", "محل", "توضیح"].map(
        (h) =>
          new TableCell({
            children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, children: [rtlText(h, { bold: true, color: "FFFFFF", size: 20 })] })],
            shading: { fill: TEAL },
          })
      ),
    });
    const rows = input.guideline.items.map(
      (it: any) =>
        new TableRow({
          children: [it.item || "—", STATUS_FA[it.status] || it.status, it.location || "—", it.comment || "—"].map(
            (v) =>
              new TableCell({
                children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, children: [rtlText(String(v), { size: 19 })] })],
              })
          ),
        })
    );
    children.push(new Table({ rows: [gh, ...rows], width: { size: 100, type: WidthType.PERCENTAGE } }) as any);
  }

  // ---------- Statistical audit ----------
  if (reportKind === "full" && input.stats) {
    children.push(heading("ممیزی آماری و روش‌شناختی", 2));
    if (input.stats.summary) children.push(p(input.stats.summary));
    for (const f of input.stats.findings || []) {
      children.push(heading(`یافته: ${f.problem?.slice(0, 80) || "—"}`, 3, ORANGE));
      children.push(kvLine("محل", f.location || "—"));
      if (f.excerpt) children.push(kvLine("نقل‌قول", f.excerpt));
      children.push(kvLine("مشکل", f.problem || "—"));
      children.push(kvLine("اهمیت", f.whyItMatters || "—"));
      children.push(kvLine("اصلاح پیشنهادی", f.correction || "—"));
      if (f.alternativeMethod) children.push(kvLine("روش آماری جایگزین", f.alternativeMethod));
      if (f.correctedReportingExample) children.push(kvLine("نمونه گزارش‌دهی اصلاح‌شده", f.correctedReportingExample));
    }
    if (input.stats.needsRawData?.length) {
      children.push(heading("موارد نیازمند داده خام", 3));
      input.stats.needsRawData.forEach((x: string) => children.push(bullet(x)));
    }
  }

  // ---------- References ----------
  if (reportKind === "full" && input.references?.references?.length) {
    children.push(heading("راستی‌آزمایی منابع", 2));
    if (input.references.summary) children.push(p(input.references.summary));
    const STATUS: Record<string, string> = {
      verified: "تأییدشده",
      partial: "تأیید جزئی",
      wrong_metadata: "متادیتای نادرست",
      doi_not_found: "DOI یافت نشد",
      possibly_retracted: "احتمال بازنشانی (Retraction)",
      unverified: "قابل راستی‌آزمایی نبود",
    };
    const rh = new TableRow({
      children: ["#", "استناد", "وضعیت", "یادداشت"].map(
        (h) =>
          new TableCell({
            children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, children: [rtlText(h, { bold: true, color: "FFFFFF", size: 20 })] })],
            shading: { fill: NAVY },
          })
      ),
    });
    const rows = input.references.references.map(
      (r: any, i: number) =>
        new TableRow({
          children: [String(i + 1), (r.raw || "").slice(0, 220), STATUS[r.check?.status] || "—", r.check?.note || ""].map(
            (v) =>
              new TableCell({
                children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, children: [rtlText(String(v), { size: 19 })] })],
              })
          ),
        })
    );
    children.push(new Table({ rows: [rh, ...rows], width: { size: 100, type: WidthType.PERCENTAGE } }) as any);
  }

  // ---------- Journal ----------
  if (reportKind === "full" && input.journal) {
    children.push(heading("ارزیابی آمادگی انتشار", 2));
    children.push(p(`امتیاز آمادگی: ${input.journal.readinessScore ?? "—"} از 100 — توصیه: ${RECOMMENDATION_FA[input.journal.recommendation] || input.journal.recommendation}`, { bold: true }));
    if (input.journal.summary) children.push(p(input.journal.summary));
    if (input.journal.uncertaintyNote) children.push(p(input.journal.uncertaintyNote, { color: SLATE, size: 20 }));
  }

  // ---------- Reviewer simulation ----------
  if (reportKind === "full" && input.reviewers?.reviewers?.length) {
    children.push(heading("شبیه‌سازی پنل داوران", 2));
    const ROLE_FA: Record<string, string> = {
      expert: "داور ۱ — کارشناس موضوع",
      methodologist: "داور ۲ — متدولوژیست/اپیدمیولوژیست",
      biostatistician: "داور ۳ — بیواستاتیستین",
      editor: "داور ۴ — سردبیر آکادمیک",
    };
    for (const r of input.reviewers.reviewers) {
      children.push(heading(ROLE_FA[r.role] || r.role, 3));
      children.push(p(`توصیه: ${RECOMMENDATION_FA[r.recommendation] || r.recommendation}`, { bold: true }));
      if (r.justification) children.push(p(r.justification));
      if (r.strengths?.length) {
        children.push(p("نقاط قوت:", { bold: true }));
        r.strengths.forEach((s: string) => children.push(bullet(s)));
      }
      if (r.majorWeaknesses?.length) {
        children.push(p("نقاط ضعف اساسی:", { bold: true, color: ORANGE }));
        r.majorWeaknesses.forEach((s: string) => children.push(bullet(s)));
      }
      if (r.minorWeaknesses?.length) {
        children.push(p("نقاط ضعف جزئی:", { bold: true, color: SLATE }));
        r.minorWeaknesses.forEach((s: string) => children.push(bullet(s)));
      }
      if (r.questionsToAuthors?.length) {
        children.push(p("پرسش‌ها از نویسندگان:", { bold: true }));
        r.questionsToAuthors.forEach((s: string) => children.push(bullet(s)));
      }
    }
    if (input.reviewers.synthesis) {
      children.push(heading("سنتز سردبیری", 3));
      if (input.reviewers.synthesis.explanation) children.push(p(input.reviewers.synthesis.explanation));
      if (input.reviewers.synthesis.priorities?.length) {
        children.push(p("اولویت‌های اصلاح:", { bold: true }));
        input.reviewers.synthesis.priorities.forEach((s: string) => children.push(bullet(s)));
      }
    }
  }

  // ---------- Report A ----------
  if (input.reports && (reportKind === "authors" || reportKind === "full")) {
    const ra = input.reports.reportA;
    children.push(heading("گزارش A — نظرات برای نویسندگان", 1));
    if (ra?.generalAssessment) children.push(p(ra.generalAssessment));
    if (ra?.strengths?.length) {
      children.push(heading("نقاط قوت", 3, TEAL));
      ra.strengths.forEach((s: string) => children.push(bullet(s)));
    }
    if (ra?.majorConcerns?.length) {
      children.push(heading("نگرانی‌های اساسی", 3, RED));
      ra.majorConcerns.forEach((iss: any, i: number) => children.push(...issueBlock(iss, i + 1)));
    }
    if (ra?.minorConcerns?.length) {
      children.push(heading("نگرانی‌های جزئی", 3, AMBER));
      ra.minorConcerns.forEach((iss: any, i: number) => children.push(...issueBlock(iss, i + 1)));
    }
    if (ra?.detailedRecommendations?.length) {
      children.push(heading("توصیه‌های تفصیلی", 3));
      ra.detailedRecommendations.forEach((s: string) => children.push(bullet(s)));
    }
    if (ra?.overallAssessment) children.push(p(ra.overallAssessment, { bold: true }));
  }

  // ---------- Report B ----------
  if (input.reports && (reportKind === "editor" || reportKind === "full")) {
    const rb = input.reports.reportB;
    children.push(heading("گزارش B — نظرات محرمانه برای سردبیر", 1));
    children.push(
      p("این گزارش صرفاً برای هیئت تحریریه است و نباید به نویسندگان منتقل شود.", { bold: true, color: RED })
    );
    if (rb?.scientificMerit) children.push(p(`ارزش علمی: ${rb.scientificMerit}`));
    if (rb?.novelty) children.push(p(`نوآوری: ${rb.novelty}`));
    if (rb?.methodologicalReliability) children.push(p(`اعتبار روش‌شناختی: ${rb.methodologicalReliability}`));
    if (rb?.ethicalIntegrityConcerns) children.push(p(`نگرانی‌های اخلاقی/صداقت علمی: ${rb.ethicalIntegrityConcerns}`));
    if (rb?.journalSuitability) children.push(p(`تناسب با مجله: ${rb.journalSuitability}`));
    if (rb?.reasonsForRecommendation?.length) {
      children.push(p("دلایل توصیه:", { bold: true }));
      rb.reasonsForRecommendation.forEach((s: string) => children.push(bullet(s)));
    }
    if (rb?.suggestedDecision) children.push(p(`تصمیم پیشنهادی: ${RECOMMENDATION_FA[rb.suggestedDecision] || rb.suggestedDecision}`, { bold: true }));
    if (rb?.confidentialNote) children.push(p(rb.confidentialNote));
  }

  // ---------- Footer ----------
  children.push(new Paragraph({ text: "" }));
  children.push(
    p(
      "این گزارش توسط سامانه پژوهش‌یار هوشمند تولید شده است و جایگزین داوری انسانی مجاز یا تصمیم هیئت تحریریه نیست.",
      { color: SLATE, size: 19 }
    )
  );
  children.push(p("طراح و سازنده: سید مجتبی کاظمی — عضو هیئت علمی گروه پرستاری، دانشکده علوم پزشکی بهبهان", { color: SLATE, size: 19 }));

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Vazirmatn", size: 22 } },
      },
    },
    sections: [{ properties: {}, children: children as any }],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
