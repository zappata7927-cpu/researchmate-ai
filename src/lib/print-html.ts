/**
 * ResearchMate AI — printable HTML report (RTL, print-to-PDF ready).
 * Serves as the "Printable HTML" export; the browser's print dialog can save
 * it as PDF with perfect Persian shaping.
 */

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SEVERITY_FA: Record<string, string> = {
  critical: "بحرانی",
  major: "اساسی",
  moderate: "متوسط",
  minor: "جزئی",
};
const SEVERITY_COLOR: Record<string, string> = {
  critical: "#dc2626",
  major: "#ea580c",
  moderate: "#d97706",
  minor: "#64748b",
};
const RECOMMENDATION_FA: Record<string, string> = {
  accept: "پذیرش",
  minor_revision: "پذیرش با بازنگری جزئی",
  major_revision: "بازنگری اساسی",
  reject: "رد",
  not_assessable: "غیرقابل ارزیابی",
  ready: "آماده ارسال",
  high_rejection_risk: "ریسک بالای رد",
  insufficient_info: "اطلاعات ناکافی",
};
const CATEGORY_FA: Record<string, string> = {
  methodological: "روش‌شناختی",
  statistical: "آماری",
  reasoning: "استدلال",
  ethical: "اخلاقی",
  reporting: "گزارش‌دهی",
  reference: "منابع",
  language: "نگارش",
  publication: "انتشار",
};

function issueHTML(issue: any, idx: number): string {
  const color = SEVERITY_COLOR[issue.severity] || "#64748b";
  return `<div class="issue" style="border-right:4px solid ${color}">
    <div class="issue-title">${esc(idx + 1)}. ${esc(issue.title)} <span class="chip" style="background:${color}">${esc(SEVERITY_FA[issue.severity] || "")}</span> <span class="chip gray">${esc(CATEGORY_FA[issue.category] || issue.category)}</span></div>
    <div class="row"><b>محل در سند:</b> ${esc(issue.location || "—")}</div>
    ${issue.excerpt ? `<div class="row"><b>نقل‌قول:</b> <i>${esc(issue.excerpt)}</i></div>` : ""}
    <div class="row"><b>توضیح علمی:</b> ${esc(issue.explanation || "—")}</div>
    <div class="row"><b>چرا مهم است:</b> ${esc(issue.whyMatters || "—")}</div>
    <div class="row"><b>پیشنهاد اصلاح:</b> ${esc(issue.suggestion || "—")}</div>
    <div class="row"><b>راه‌حل عملی:</b> ${esc(issue.detailedSolution || "—")}</div>
    ${issue.suggestedText ? `<div class="row"><b>متن پیشنهادی:</b> <span class="suggest">${esc(issue.suggestedText)}</span></div>` : ""}
    ${issue.guideline ? `<div class="row"><b>استاندارد پشتیبان:</b> ${esc(issue.guideline)}</div>` : ""}
  </div>`;
}

function listHTML(items: string[] | undefined): string {
  if (!items?.length) return "";
  return `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

export interface PrintInput {
  reportKind: "authors" | "editor" | "full";
  projectTitle: string;
  docTypeLabel: string;
  generatedAt: string;
  score: { total: number | null; assessable: number; totalCriteria: number; hasCriticalProblem: boolean; counts: any; perCriterion: any[]; recommendation: string } | null;
  review: any;
  guideline?: { name: string; complianceScore?: number; items?: any[] } | null;
  stats?: any | null;
  references?: any | null;
  journal?: any | null;
  reviewers?: any | null;
  reports?: any | null;
  disclaimers: string[];
}

export function buildPrintHTML(input: PrintInput): string {
  const { reportKind } = input;
  const band =
    input.score?.total == null
      ? { label: "غیرقابل ارزیابی", color: "#64748b" }
      : input.score.total >= 85
        ? { label: "عالی", color: "#0f766e" }
        : input.score.total >= 70
          ? { label: "خوب", color: "#0891b2" }
          : input.score.total >= 55
            ? { label: "قابل قبول", color: "#d97706" }
            : input.score.total >= 40
              ? { label: "ضعیف", color: "#ea580c" }
              : { label: "بسیار ضعیف", color: "#dc2626" };

  const sections: string[] = [];

  sections.push(`<section class="card">
    <h2>مشخصات گزارش</h2>
    <div class="row"><b>عنوان سند:</b> ${esc(input.projectTitle)}</div>
    <div class="row"><b>نوع سند:</b> ${esc(input.docTypeLabel)}</div>
    <div class="row"><b>نوع گزارش:</b> ${reportKind === "authors" ? "گزارش A — نظرات برای نویسندگان" : reportKind === "editor" ? "گزارش B — نظرات محرمانه برای سردبیر" : "گزارش فنی جامع"}</div>
    <div class="row"><b>تاریخ تولید:</b> ${esc(input.generatedAt)}</div>
  </section>`);

  sections.push(`<section class="card">
    <h2>نکات مهم و محدودیت‌ها</h2>
    ${listHTML(input.disclaimers)}
  </section>`);

  if (input.score) {
    const rows = input.score.perCriterion
      .map(
        (c: any) =>
          `<tr><td>${esc(c.label)}</td><td>${c.weight}</td><td>${c.score === null ? "غیرقابل ارزیابی" : esc(c.score)}</td><td>${c.weighted === null ? "—" : esc(c.weighted.toFixed(1))}</td></tr>`
      )
      .join("");
    sections.push(`<section class="card">
      <h2>امتیاز کلی</h2>
      <div class="score-line">
        <span class="big" style="color:${band.color}">${input.score.total === null ? "—" : input.score.total}</span>
        <span>از 100 — <b style="color:${band.color}">${band.label}</b></span>
        <span class="chip gray">معیارهای قابل ارزیابی: ${input.score.assessable} از ${input.score.totalCriteria}</span>
        <span class="chip gray">توصیه: ${esc(RECOMMENDATION_FA[input.score.recommendation] || input.score.recommendation)}</span>
      </div>
      ${input.score.hasCriticalProblem ? `<div class="alert">هشدار: حداقل یک مشکل بحرانی شناسایی شد؛ این مشکل مستقل از امتیاز کل است.</div>` : ""}
      <table><thead><tr><th>معیار</th><th>وزن</th><th>امتیاز (از 5)</th><th>نمره وزنی</th></tr></thead><tbody>${rows}</tbody></table>
    </section>`);
  }

  const review = input.review;
  if (reportKind !== "editor" && review) {
    const issues: any[] = review.issues || [];
    const majors = issues.filter((i: any) => i.severity === "critical" || i.severity === "major");
    const minors = issues.filter((i: any) => i.severity === "moderate" || i.severity === "minor");
    sections.push(`<section class="card">
      <h2>ارزیابی کلی داوری</h2>
      ${review.summary ? `<p>${esc(review.summary)}</p>` : ""}
      ${review.strengths?.length ? `<h3>نقاط قوت</h3>${listHTML(review.strengths)}` : ""}
      ${majors.length ? `<h3 class="red">ایرادهای اساسی و بحرانی</h3>${majors.map((i: any, idx: number) => issueHTML(i, idx)).join("")}` : ""}
      ${minors.length ? `<h3>ایرادهای متوسط و جزئی</h3>${minors.map((i: any, idx: number) => issueHTML(i, idx)).join("")}` : ""}
      ${
        review.overallRecommendation
          ? `<div class="row"><b>توصیه نهایی داور:</b> ${esc(RECOMMENDATION_FA[review.overallRecommendation] || review.overallRecommendation)}</div>${review.recommendationExplanation ? `<p>${esc(review.recommendationExplanation)}</p>` : ""}`
          : ""
      }
    </section>`);
  }

  if (reportKind === "full" && input.guideline?.items?.length) {
    const STATUS: Record<string, string> = { reported: "گزارش‌شده", partial: "ناقص", missing: "گزارش‌نشده", na: "غیرقابل ارزیابی" };
    const rows = input.guideline.items
      .map(
        (it: any) =>
          `<tr><td>${esc(it.item)}</td><td>${esc(STATUS[it.status] || it.status)}</td><td>${esc(it.location || "—")}</td><td>${esc(it.comment || "")}</td></tr>`
      )
      .join("");
    sections.push(`<section class="card">
      <h2>تبعیت از راهنمای گزارش‌دهی — ${esc(input.guideline.name)}</h2>
      <div class="row"><b>نمره تبعیت:</b> ${input.guideline.complianceScore ?? "—"} از 100</div>
      <table><thead><tr><th>آیتم</th><th>وضعیت</th><th>محل</th><th>توضیح</th></tr></thead><tbody>${rows}</tbody></table>
    </section>`);
  }

  if (reportKind === "full" && input.stats) {
    sections.push(`<section class="card">
      <h2>ممیزی آماری و روش‌شناختی</h2>
      ${input.stats.summary ? `<p>${esc(input.stats.summary)}</p>` : ""}
      ${(input.stats.findings || [])
        .map(
          (f: any) => `<div class="issue" style="border-right-color:#ea580c">
            <div class="issue-title">${esc(f.problem || "یافته")}</div>
            <div class="row"><b>محل:</b> ${esc(f.location || "—")}</div>
            ${f.excerpt ? `<div class="row"><b>نقل‌قول:</b> <i>${esc(f.excerpt)}</i></div>` : ""}
            <div class="row"><b>اهمیت:</b> ${esc(f.whyItMatters || "—")}</div>
            <div class="row"><b>اصلاح پیشنهادی:</b> ${esc(f.correction || "—")}</div>
            ${f.alternativeMethod ? `<div class="row"><b>روش جایگزین:</b> ${esc(f.alternativeMethod)}</div>` : ""}
            ${f.correctedReportingExample ? `<div class="row"><b>نمونه گزارش اصلاح‌شده:</b> <span class="suggest">${esc(f.correctedReportingExample)}</span></div>` : ""}
          </div>`
        )
        .join("")}
      ${input.stats.needsRawData?.length ? `<h3>موارد نیازمند داده خام</h3>${listHTML(input.stats.needsRawData)}` : ""}
    </section>`);
  }

  if (reportKind === "full" && input.references?.references?.length) {
    const STATUS: Record<string, string> = {
      verified: "تأییدشده",
      partial: "تأیید جزئی",
      wrong_metadata: "متادیتای نادرست",
      doi_not_found: "DOI یافت نشد",
      possibly_retracted: "احتمال Retraction",
      unverified: "قابل راستی‌آزمایی نبود",
    };
    const rows = input.references.references
      .map(
        (r: any, i: number) =>
          `<tr><td>${i + 1}</td><td class="ltr" dir="ltr">${esc((r.raw || "").slice(0, 260))}</td><td>${esc(STATUS[r.check?.status] || "—")}${r.check?.retracted ? " ⚠" : ""}</td><td>${esc(r.check?.note || "")}</td></tr>`
      )
      .join("");
    sections.push(`<section class="card">
      <h2>راستی‌آزمایی منابع</h2>
      ${input.references.summary ? `<p>${esc(input.references.summary)}</p>` : ""}
      <table><thead><tr><th>#</th><th>استناد</th><th>وضعیت</th><th>یادداشت</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="note">یادآوری: «قابل راستی‌آزمایی نبود» به‌معنای وجود نداشتن سند نیست.</p>
    </section>`);
  }

  if (reportKind === "full" && input.journal) {
    sections.push(`<section class="card">
      <h2>ارزیابی آمادگی انتشار</h2>
      <div class="row"><b>امتیاز آمادگی:</b> ${input.journal.readinessScore ?? "—"} از 100 — <b>توصیه:</b> ${esc(RECOMMENDATION_FA[input.journal.recommendation] || input.journal.recommendation)}</div>
      ${input.journal.summary ? `<p>${esc(input.journal.summary)}</p>` : ""}
      ${input.journal.uncertaintyNote ? `<p class="note">${esc(input.journal.uncertaintyNote)}</p>` : ""}
      ${input.journal.missingDeclarations?.length ? `<h3>اعلامیه‌های جاافتاده</h3>${listHTML(input.journal.missingDeclarations)}` : ""}
    </section>`);
  }

  if (reportKind === "full" && input.reviewers?.reviewers?.length) {
    const ROLE_FA: Record<string, string> = {
      expert: "داور ۱ — کارشناس موضوع",
      methodologist: "داور ۲ — متدولوژیست/اپیدمیولوژیست",
      biostatistician: "داور ۳ — بیواستاتیستین",
      editor: "داور ۴ — سردبیر آکادمیک",
    };
    const cards = input.reviewers.reviewers
      .map(
        (r: any) => `<div class="issue">
          <div class="issue-title">${esc(ROLE_FA[r.role] || r.role)} — توصیه: ${esc(RECOMMENDATION_FA[r.recommendation] || r.recommendation)}</div>
          ${r.justification ? `<p>${esc(r.justification)}</p>` : ""}
          ${r.strengths?.length ? `<b>نقاط قوت:</b>${listHTML(r.strengths)}` : ""}
          ${r.majorWeaknesses?.length ? `<b>ضعف‌های اساسی:</b>${listHTML(r.majorWeaknesses)}` : ""}
          ${r.minorWeaknesses?.length ? `<b>ضعف‌های جزئی:</b>${listHTML(r.minorWeaknesses)}` : ""}
          ${r.questionsToAuthors?.length ? `<b>پرسش از نویسندگان:</b>${listHTML(r.questionsToAuthors)}` : ""}
        </div>`
      )
      .join("");
    sections.push(`<section class="card">
      <h2>شبیه‌سازی پنل داوران</h2>
      ${cards}
      ${input.reviewers.synthesis?.explanation ? `<h3>سنتز سردبیری</h3><p>${esc(input.reviewers.synthesis.explanation)}</p>` : ""}
      ${input.reviewers.synthesis?.priorities?.length ? `<b>اولویت‌های اصلاح:</b>${listHTML(input.reviewers.synthesis.priorities)}` : ""}
    </section>`);
  }

  if (input.reports && (reportKind === "authors" || reportKind === "full")) {
    const ra = input.reports.reportA || {};
    sections.push(`<section class="card">
      <h2>گزارش A — نظرات برای نویسندگان</h2>
      ${ra.generalAssessment ? `<p>${esc(ra.generalAssessment)}</p>` : ""}
      ${ra.strengths?.length ? `<h3>نقاط قوت</h3>${listHTML(ra.strengths)}` : ""}
      ${ra.majorConcerns?.length ? `<h3 class="red">نگرانی‌های اساسی</h3>${ra.majorConcerns.map((i: any, idx: number) => issueHTML(i, idx)).join("")}` : ""}
      ${ra.minorConcerns?.length ? `<h3>نگرانی‌های جزئی</h3>${ra.minorConcerns.map((i: any, idx: number) => issueHTML(i, idx)).join("")}` : ""}
      ${ra.detailedRecommendations?.length ? `<h3>توصیه‌های تفصیلی</h3>${listHTML(ra.detailedRecommendations)}` : ""}
      ${ra.overallAssessment ? `<p><b>${esc(ra.overallAssessment)}</b></p>` : ""}
    </section>`);
  }

  if (input.reports && (reportKind === "editor" || reportKind === "full")) {
    const rb = input.reports.reportB || {};
    sections.push(`<section class="card" style="border:2px solid #dc2626">
      <h2 class="red">گزارش B — نظرات محرمانه برای سردبیر</h2>
      <p class="alert">این گزارش صرفاً برای هیئت تحریریه است و نباید به نویسندگان منتقل شود.</p>
      ${rb.scientificMerit ? `<div class="row"><b>ارزش علمی:</b> ${esc(rb.scientificMerit)}</div>` : ""}
      ${rb.novelty ? `<div class="row"><b>نوآوری:</b> ${esc(rb.novelty)}</div>` : ""}
      ${rb.methodologicalReliability ? `<div class="row"><b>اعتبار روش‌شناختی:</b> ${esc(rb.methodologicalReliability)}</div>` : ""}
      ${rb.ethicalIntegrityConcerns ? `<div class="row"><b>نگرانی‌های اخلاقی:</b> ${esc(rb.ethicalIntegrityConcerns)}</div>` : ""}
      ${rb.journalSuitability ? `<div class="row"><b>تناسب با مجله:</b> ${esc(rb.journalSuitability)}</div>` : ""}
      ${rb.reasonsForRecommendation?.length ? `<b>دلایل توصیه:</b>${listHTML(rb.reasonsForRecommendation)}` : ""}
      ${rb.suggestedDecision ? `<div class="row"><b>تصمیم پیشنهادی:</b> ${esc(RECOMMENDATION_FA[rb.suggestedDecision] || rb.suggestedDecision)}</div>` : ""}
      ${rb.confidentialNote ? `<p>${esc(rb.confidentialNote)}</p>` : ""}
    </section>`);
  }

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>گزارش داوری — ${esc(input.projectTitle)} | پژوهش‌یار هوشمند</title>
<link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body { font-family: Vazirmatn, Tahoma, sans-serif; background:#f5f7fa; color:#10233b; margin:0; padding:24px; }
  .wrap { max-width: 860px; margin: 0 auto; }
  .print-bar { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
  .print-btn { background:#0e2a47; color:#fff; border:none; padding:10px 22px; border-radius:10px; font-family:inherit; font-size:15px; cursor:pointer; }
  .print-btn:hover { background:#0f766e; }
  header.hero { background:linear-gradient(135deg,#081c33,#123c56); color:#fff; border-radius:16px; padding:26px 30px; margin-bottom:18px; }
  header.hero h1 { margin:0 0 6px; font-size:24px; }
  header.hero .sub { color:#9fd8cf; font-size:14px; }
  .card { background:#fff; border:1px solid #dbe3ec; border-radius:14px; padding:22px 26px; margin-bottom:16px; }
  h2 { color:#0e2a47; font-size:19px; border-bottom:2px solid #0f766e; padding-bottom:8px; margin-top:0; }
  h3 { color:#0f766e; font-size:16px; margin:14px 0 8px; }
  h3.red, .red { color:#dc2626; }
  p { line-height:2; text-align:justify; margin:8px 0; font-size:14px; }
  .row { font-size:13.5px; line-height:2; margin:4px 0; }
  .issue { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 16px; margin:10px 0; }
  .issue-title { font-weight:700; font-size:14.5px; margin-bottom:6px; }
  .chip { color:#fff; font-size:11px; padding:2px 10px; border-radius:99px; margin-inline-start:6px; }
  .chip.gray { background:#64748b; }
  .suggest { background:#e6f5f3; border-radius:6px; padding:2px 8px; display:inline-block; line-height:2; }
  table { width:100%; border-collapse:collapse; font-size:13px; margin-top:8px; }
  th { background:#0e2a47; color:#fff; padding:8px; }
  td { border:1px solid #e2e8f0; padding:7px 9px; text-align:right; }
  tr:nth-child(even) td { background:#f8fafc; }
  .alert { background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; border-radius:8px; padding:10px 14px; margin:10px 0; font-size:13.5px; }
  .note { color:#64748b; font-size:12.5px; }
  ul { line-height:2; font-size:14px; margin:6px 0; padding-right:20px; }
  .score-line { display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin:10px 0; }
  .big { font-size:42px; font-weight:800; }
  .ltr { direction:ltr; text-align:left; font-size:12px; }
  footer { text-align:center; color:#64748b; font-size:12.5px; padding:20px 0; line-height:2; }
  @media print {
    body { background:#fff; padding:0; }
    .print-bar { display:none; }
    .card { border:none; padding:10px 0; page-break-inside:avoid; }
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="print-bar">
    <div style="color:#64748b;font-size:13px">پژوهش‌یار هوشمند — گزارش رسمی داوری</div>
    <button class="print-btn" onclick="window.print()">چاپ / ذخیره PDF</button>
  </div>
  <header class="hero">
    <h1>پژوهش‌یار هوشمند | ResearchMate AI</h1>
    <div class="sub">سامانه هوشمند ارزیابی، داوری و ارتقای کیفیت پژوهش — From Research Submission to Scientific Excellence</div>
  </header>
  ${sections.join("\n")}
  <footer>
    طراح و سازنده: سید مجتبی کاظمی — عضو هیئت علمی گروه پرستاری، دانشکده علوم پزشکی بهبهان<br>
    این گزارش جایگزین داوری انسانی مجاز یا تصمیم هیئت تحریریه نیست.
  </footer>
</div>
</body>
</html>`;
}
