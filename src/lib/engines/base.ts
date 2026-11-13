/**
 * ResearchMate AI — shared engine foundation.
 * System-prompt principles enforce scientific honesty per Section 16 of the spec:
 * never fabricate, cite exact locations, distinguish confirmed findings from
 * potential concerns, mark unavailable information as Not Assessable.
 */

import { chatJSON } from "../ai";
import {
  reviewCoreSchema,
  classificationSchema,
  manuscriptReviewSchema,
  statsAuditSchema,
  journalReviewSchema,
  reviewerSimulationSchema,
  reportsSchema,
  revisionProposalSchema,
  responseLetterSchema,
  criteriaOnlySchema,
  manuscriptScoringSchema,
} from "../schemas";

export const SCIENTIFIC_INTEGRITY_PROMPT = `
اصول الزامی تو (در صورت نقض، خروجی نامعتبر است):
1. هرگز محتوا، داده، نتیجه، منبع یا نقل‌قولی که در سند وجود ندارد را نمی‌سازی و نمی‌پنداری.
2. هر ایراد مهم را با ذکر دقیق محل آن در سند (بخش/زیربخش و عبارت مرتبط) گزارش می‌کنی.
3. اگر اطلاعات لازم برای قضاوت در سند نباشد، امتیاز آن معیار را null (غیرقابل ارزیابی) می‌دهی و در missingInfo می‌نویسی چه چیزی لازم است؛ هرگز غیاب اطلاعات را صفر یا کامل فرض نمی‌کنی.
4. یافته‌های «قطعی» را از «نگرانی بالقوه» متمایز می‌کنی و در جاهای لازم بر عدم قطعیت صریحاً تأکید می‌کنی.
5. هرگز ادعا نمی‌کنی آماره‌ای را بازمحاسبه کرده‌ای؛ فقط بررسی سازگاری درون‌متنی انجام می‌دهی.
6. ایرادهای اساسی روش‌شناختی را قبل از ایرادهای جزئی نگارشی اولویت‌بندی می‌کنی.
7. تمام خروجی متنی به زبان فارسی روان و علمی است؛ اصطلاحات فنی را می‌توانی همراه معادل انگلیسی بیاوری.
8. فقط و فقط یک شیء JSON معتبر مطابق ساختار خواسته‌شده برمی‌گردانی؛ بدون هیچ متن اضافه یا بلوک کد.
`.trim();

function buildCriterionInstruction(rubricList: Array<{ key: string; label: string }>): string {
  return `\nمعیارهای امتیازدهی (دقیقاً همین کلیدها را برگردان):\n${rubricList
    .map((r) => `- key="${r.key}" — ${r.label}`)
    .join("\n")}\nهر معیار: score عددی 0 تا 5 (0=فاقد/بسیار ناکافی، 1=خیلی ضعیف، 2=ضعیف، 3=قابل قبول، 4=خوب، 5=عالی) یا null اگر غیرقابل ارزیابی است؛ justification مستدل مبتنی بر شواهد سند؛ missingInfo اگر چیزی برای ارزیابی کم است؛ location محل در سند.`;
}

function buildIssueInstruction(): string {
  return `\nهر ایراد (issue) دقیقاً این 10 جزء را دارد: title، category (یکی از: methodological|statistical|reasoning|ethical|reporting|reference|language|publication)، severity (critical|major|moderate|minor)، location (محل دقیق در سند)، excerpt (نقل قول کوتاه مرتبط از سند؛ اگر عین متن موجود نیست رشته خالی بگذار)، explanation (توضیح علمی ایراد)، whyMatters (چرا این ایراد مهم است)، suggestion (پیشنهاد اصلاح)، detailedSolution (راه‌حل عملی گام‌به‌گام)، suggestedText (متن پیشنهادی جایگزین در صورت لزوم؛ وگرنه null)، guideline (استاندارد/راهنمای پشتیبان مثل CONSORT 2025 یا STROBE؛ وگرنه null).`;
}

export function clip(text: string, max = 58000): string {
  if (text.length <= max) return text;
  const head = text.slice(0, Math.floor(max * 0.7));
  const tail = text.slice(-Math.floor(max * 0.25));
  return `${head}\n\n[... بخش میانی سند به‌دلیل حجم بریده شد ...]\n\n${tail}`;
}

// ---------------------------------------------------------------------------
// 1) Classification engine
// ---------------------------------------------------------------------------
export async function runClassification(text: string, heuristic: { docType: string; language: string }) {
  const system = `تو موتور تشخیص نوع سند پژوهشی هستی. خروجی تو فقط JSON است.
${SCIENTIFIC_INTEGRITY_PROMPT}`;

  const user = `نوع سند پژوهشی را تشخیص بده.
نشانه‌های تشخیص واژگانی اولیه (فقط راهنماست، ملاک نهایی تحلیل خودت است): ${JSON.stringify(heuristic)}

سند:
"""
${clip(text, 30000)}
"""

ساختار JSON خروجی:
{
  "docType": "proposal|manuscript|protocol|systematic_review|case_report|thesis|other",
  "confidence": عدد 0..1,
  "language": "fa|en|mixed",
  "design": "طرح مطالعه به فارسی (مثلاً کارآزمایی تصادفی‌سازی‌شده دوسوکور، مطالعه مقطعی، مرور نظام‌مند و ...)",
  "suggestedGuideline": "کلید راهنمای گزارش‌دهی پیشنهادی مثل consort|strobe|prisma|spirit|stard|tripod_ai|coreq|care|arrive|squire|cheers یا null",
  "rationale": "توضیح کوتاه چرا این نوع را تشخیص دادی"
}`;
  const { data, meta } = await chatJSON(system, user, (d) => classificationSchema.parse(d), {
    retryNote: "خروجی قبلی JSON معتبر نبود.",
  });
  return { data, meta };
}

// ---------------------------------------------------------------------------
// 2) Proposal review engine — two-phase: (a) qualitative review, (b) scoring
// ---------------------------------------------------------------------------
const SCORE_RETRY_NOTE =
  "پاسخ قبلی فاقد آرایه کامل criteria بود. آرایه criteria الزامی است و باید برای تک‌تک معیارهای فهرست‌شده یک شیء شامل key، score (عدد 0..5 یا null)، justification، location و missingInfo داشته باشد.";

async function scoreCriteria(
  kind: "proposal" | "manuscript",
  text: string,
  rubric: Array<{ key: string; label: string; weight?: number }>,
  meta: { title: string; language: string; design?: string }
) {
  const system = `تو عضو کمیته علمی دانشگاه هستی و فقط کار امتیازدهی روبریک را انجام می‌دهی.
${SCIENTIFIC_INTEGRITY_PROMPT}
معیارها (دقیقاً همین کلیدها، به‌همین تعداد):
${rubric.map((r) => `- key="${r.key}" — ${r.label}`).join("\n")}
برای هر معیار: score عددی 0 تا 5 (0=فاقد/بسیار ناکافی، 1=خیلی ضعیف، 2=ضعیف، 3=قابل قبول، 4=خوب، 5=عالی) یا null اگر غیرقابل ارزیابی است؛ justification حداکثر دو جمله مستند به سند؛ missingInfo در صورت کمبود اطلاعات؛ location محل در سند.
فقط JSON برگردان: {"criteria": [...]}`;
  const user = `امتیازدهی روبریک برای این ${kind === "manuscript" ? "مقاله" : "پروپوزال"}:
عنوان: ${meta.title}

سند:
"""
${clip(text, 45000)}
"""`;
  const { data } = await chatJSON(
    system,
    user,
    (d) => {
      const parsed = criteriaOnlySchema.parse(d);
      const found = new Set(parsed.criteria.map((c) => c.key));
      const needed = rubric.filter((r) => !found.has(r.key)).length;
      if (parsed.criteria.length < Math.min(3, rubric.length) || needed > Math.ceil(rubric.length / 3)) {
        throw new Error("criteria incomplete");
      }
      return parsed;
    },
    { retryNote: SCORE_RETRY_NOTE }
  );
  return data.criteria;
}

export async function runProposalReview(
  text: string,
  rubric: Array<{ key: string; label: string }>,
  meta: { title: string; language: string; design?: string }
) {
  const system = `تو یک داور پژوهشی ارشد و عضو کمیته علمی دانشگاه هستی؛ ترکیبی از متدولوژیست، اپیدمیولوژیست، بیواستاتیستین و سردبیر مجله. یک پروپوزال پژوهشی را با دقت کامل داوری می‌کنی.
دامنه‌های داوری: عنوان و بیان مسئله؛ اهمیت و نوآوری؛ مرور ادبیات؛ اهداف و فرضیه‌ها؛ روش‌شناسی (طرح، جامعه، معیارها، نمونه‌گیری، حجم نمونه، مداخله، کنترل، تصادفی‌سازی، کورسازی، مخدوش‌گرها، سوگیری‌ها، رویه جمع‌آوری داده، بازتولیدپذیری)؛ ابزارهای سنجش (روایی، پایایی، تطبیق فرهنگی)؛ تحلیل آماری؛ اخلاق (کمیته اخلاق، رضایت آگاهانه، محرمانگی، ثبت کارآزمایی، جمعیت‌های آسیب‌پذیر)؛ امکان‌پذیری (جذب نمونه، امکانات، تیم، زمان‌بندی، بودجه)؛ منابع و نگارش.
${SCIENTIFIC_INTEGRITY_PROMPT}
${buildIssueInstruction()}
دستورات فشرده‌سازی خروجی (برای اعتبار و خوانایی): حداکثر ۸ ایراد مهم‌تر؛ strengths حداکثر ۵ مورد؛ هر explanation حداکثر ۲ جمله؛ detailedSolution حداکثر ۳ جمله؛ excerpt فقط بخش کلیدی (حداکثر ۳۰ واژه).
خروجی شامل: summary (۴ تا ۷ جمله)، strengths، criticalFlags (آرایه رشته)، overallRecommendation و recommendationExplanation. توجه: در این مرحله امتیاز معیارها را برنگردان (بخش امتیازدهی جداگانه انجام می‌شود).`;

  const user = `داوری کامل این پروپوزال پژوهشی را انجام بده (بدون امتیازدهی معیارها).
عنوان: ${meta.title}
زبان سند: ${meta.language}
${meta.design ? `طرح مطالعه شناسایی‌شده: ${meta.design}` : ""}

سند پروپوزال:
"""
${clip(text)}
"""`;
  const { data, meta: m } = await chatJSON(system, user, (d) => reviewCoreSchema.parse(d));
  // Phase 2 — rubric scoring (separate, focused call)
  const criteria = await scoreCriteria("proposal", text, rubric, meta);
  return { data: { ...data, criteria }, meta: m };
}

// ---------------------------------------------------------------------------
// 3) Manuscript review engine (+ reporting guideline compliance)
// ---------------------------------------------------------------------------
export async function runManuscriptReview(
  text: string,
  rubric: Array<{ key: string; label: string }>,
  guideline: { key: string; name: string; checklist: string[] },
  meta: { title: string; language: string; design?: string }
) {
  const system = `تو یک داور خبره مقالات علمی برای مجلات بین‌المللی هستی؛ هم سخت‌گیری روش‌شناختی داور متدولوژیست را داری هم نگاه سردبیری به گزارش‌دهی.
نکته مهم: تبعیت از چک‌لیست گزارش‌دهی به معنای کیفیت متدولوژیک نیست؛ «اعتبار روش‌شناختی» و «کامل بودن گزارش» را مستقل از هم ارزیابی می‌کنی.
دامنه‌های داوری: عنوان و چکیده؛ مقدمه؛ روش‌ها؛ نتایج (جریان مشارکت‌دهندگان، مشخصات پایه، کامل بودن، سازگاری متن با جداول، اندازه اثر و فاصله اطمینان)؛ بحث (تفسیر، مقایسه با مطالعات قبل، توجیه‌پذیری، محدودیت‌ها، تعمیم‌پذیری، اجتناب از ادعاهای بدون پشتوانه)؛ نتیجه‌گیری؛ جداول و شکل‌ها؛ صداقت علمی (اخلاق، ثبت کارآزمایی، تعارض منافع، تأمین مالی، نویسندگی، دسترسی به داده، نشانه‌های همپوشانی انتشار)؛ منابع.
${SCIENTIFIC_INTEGRITY_PROMPT}
${buildIssueInstruction()}
دستورات فشرده‌سازی خروجی: حداکثر ۸ ایراد مهم‌تر؛ strengths حداکثر ۵ مورد؛ هر explanation حداکثر ۲ جمله؛ detailedSolution حداکثر ۳ جمله.
خروجی شامل: summary، strengths، criticalFlags (آرایه رشته)، overallRecommendation و recommendationExplanation. امتیاز معیارها و چک‌لیست در مرحله جداگانه گرفته می‌شود؛ اینجا برنگردان.`;

  const user = `داوری کامل این مقاله علمی را انجام بده (بدون امتیازدهی معیارها و بدون چک‌لیست).
عنوان: ${meta.title}
طرح مطالعه شناسایی‌شده: ${meta.design || "نامشخص"}
زبان سند: ${meta.language}

متن مقاله:
"""
${clip(text)}
"""`;
  const { data, meta: m } = await chatJSON(system, user, (d) => reviewCoreSchema.parse(d));

  // Phase 2 — criteria scoring + guideline compliance (focused call)
  const scoringSystem = `تو سردبیر ارشد مجله هستی و دو کار انجام می‌دهی: (۱) امتیازدهی روبریک، (۲) ارزیابی تبعیت از راهنمای گزارش‌دهی.
${SCIENTIFIC_INTEGRITY_PROMPT}
قسمت ۱ — معیارها (دقیقاً همین کلیدها):
${rubric.map((r) => `- key="${r.key}" — ${r.label}`).join("\n")}
برای هر معیار: score عددی 0 تا 5 یا null (غیرقابل ارزیابی)؛ justification حداکثر دو جمله؛ missingInfo در صورت کمبود؛ location.
قسمت ۲ — چک‌لیست «${guideline.name}» (این آیتم‌ها به‌همین ترتیب):
${guideline.checklist.map((c, i) => `${i + 1}. ${c}`).join("\n")}
برای هر آیتم: status یکی از reported|partial|missing|na؛ location کوتاه؛ comment حداکثر یک جمله.
complianceScore = درصد آیتم‌های reported از قابل ارزیابی‌ها (na کنار گذاشته می‌شود)، عدد 0..100.
فقط JSON برگردان: {"criteria": [...], "guideline": {"key": "${guideline.key}", "name": "${guideline.name}", "complianceScore": عدد, "items": [...]}}`;

  const scoringUser = `امتیازدهی روبریک و ارزیابی چک‌لیست برای این مقاله:
عنوان: ${meta.title}
طرح مطالعه: ${meta.design || "نامشخص"}

متن مقاله:
"""
${clip(text, 45000)}
"""`;

  const scoring = await chatJSON(
    scoringSystem,
    scoringUser,
    (d) => {
      const parsed = manuscriptScoringSchema.parse(d);
      const found = new Set(parsed.criteria.map((c) => c.key));
      const missing = rubric.filter((r) => !found.has(r.key)).length;
      if (parsed.criteria.length < Math.min(3, rubric.length) || missing > Math.ceil(rubric.length / 3)) {
        throw new Error("criteria incomplete");
      }
      return parsed;
    },
    { retryNote: SCORE_RETRY_NOTE }
  );

  return {
    data: {
      ...data,
      criteria: scoring.data.criteria,
      guideline: scoring.data.guideline || null,
    },
    meta: m,
  };
}

// ---------------------------------------------------------------------------
// 4) Statistical & methodological audit engine
// ---------------------------------------------------------------------------
export async function runStatsAudit(
  text: string,
  meta: { title: string; language: string; design?: string }
) {
  const system = `تو یک بیواستاتیستین ارشد ممیز پژوهش هستی. ممیزی آماری و روش‌شناختی این سند را انجام می‌دهی.
${SCIENTIFIC_INTEGRITY_PROMPT}
بررسی‌های لازم: تناسب آزمون آماری با سؤال پژوهش؛ تناسب آزمون با نوع متغیرها و طرح مطالعه؛ بررسی فرض‌های آماری (نرمالیته و ...)؛ توجیه حجم نمونه و توان؛ در نظر گرفتن خوشه‌بندی/اندازه‌گیری تکراری در صورت لزوم؛ کنترل مخدوش‌گری؛ شفافیت داده‌های گمشده؛ گزارش اندازه اثر و فاصله اطمینان؛ سازگاری جداول با متن؛ توجیه‌پذیری نتیجه‌گیری آماری و بالینی؛ توجه به مقایسه‌های متعدد.

هر یافته (findings) شامل: location، excerpt، problem، whyItMatters، correction، alternativeMethod (در صورت لزوم)، correctedReportingExample (نمونه گزارش‌دهی اصلاح‌شده).
در needsRawData فهرست کن چه چیزهایی فقط با داده خام قابل ارزیابی است و از آن‌ها به‌عنوان «نیازمند داده خام» یاد کن. هرگز ادعا نکن آماره‌ای بازمحاسبه کرده‌ای.
خروجی شامل: summary، issues (با ساختار ۱۰ جزئی ایراد)، findings، needsRawData و overallRecommendation. امتیاز معیارها در مرحله جداگانه گرفته می‌شود؛ اینجا criteria برنگردان.`;

  const user = `ممیزی آماری کامل این سند (بدون امتیازدهی معیارها):
عنوان: ${meta.title}
طرح مطالعه: ${meta.design || "نامشخص"}

سند:
"""
${clip(text)}
"""

ساختار JSON: {"summary", "issues": [...], "findings": [...], "needsRawData": [...], "overallRecommendation"}`;
  const { data, meta: m } = await chatJSON(system, user, (d) => statsAuditSchema.parse(d));

  // Phase 2 — focused scoring of the 8 statistical criteria
  const rubric = [
    { key: "test_fit", label: "تناسب آزمون/مدل با سؤال و طرح" },
    { key: "assumptions", label: "بررسی فرض‌های آماری" },
    { key: "sample_size", label: "حجم نمونه و توان آماری" },
    { key: "confounding", label: "کنترل مخدوش‌گرها و سوگیری‌ها" },
    { key: "missing_data", label: "مدیریت داده گمشده" },
    { key: "effect_reporting", label: "اندازه اثر، فاصله اطمینان و p" },
    { key: "consistency", label: "سازگاری جداول/شکل‌ها با متن" },
    { key: "conclusion_fit", label: "توجیه‌پذیری نتیجه‌گیری" },
  ];
  const criteria = await scoreCriteria("manuscript", text, rubric, meta);
  return { data: { ...data, criteria }, meta: m };
}

// ---------------------------------------------------------------------------
// 5) Journal suitability engine
// ---------------------------------------------------------------------------
export async function runJournalReview(
  text: string,
  meta: {
    title: string;
    design?: string;
    language: string;
    journal: string;
    articleType?: string;
    field?: string;
    indexing?: string;
    wordLimit?: number;
  }
) {
  const system = `تو سردبیر ارشد یک مجله علمی-پژوهشی هستی و آمادگی مقاله را برای ارسال به مجله هدف ارزیابی می‌کنی.
${SCIENTIFIC_INTEGRITY_PROMPT}
مهم: بدون مدل پیش‌بینی معتبر و داده تاریخی مجله، هیچ «احتمال پذیرش» عددی اعلام نمی‌کنی؛ فقط ارزیابی کیفی شفاف می‌دهی و در uncertaintyNote محدودیت این ارزیابی را می‌نویسی.
recommendation یکی از: ready|minor_revision|major_revision|high_rejection_risk|insufficient_info.
خروجی شامل: summary، readinessScore (عدد 0..100 بر اساس کامل بودن الزامات)، recommendation، recommendationExplanation، scopeFit، formattingIssues (با ساختار ۱۰ جزئی ایراد)، missingDeclarations و uncertaintyNote. معیارهای تفصیلی در مرحله جداگانه امتیازدهی می‌شوند؛ اینجا criteria برنگردان.`;

  const user = `ارزیابی آمادگی انتشار:
عنوان: ${meta.title}
مجله هدف: ${meta.journal}
نوع مقاله: ${meta.articleType || "نامشخص"}
حوزه: ${meta.field || "نامشخص"}
ایندکس‌های مدنظر: ${meta.indexing || "نامشخص"}
سقف واژه اعلام‌شده: ${meta.wordLimit || "نامشخص"}
طرح مطالعه: ${meta.design || "نامشخص"}

متن مقاله/پروپوزال:
"""
${clip(text, 45000)}
"""

ساختار JSON: {"summary", "readinessScore", "recommendation", "recommendationExplanation", "scopeFit", "formattingIssues", "missingDeclarations", "uncertaintyNote"}`;
  const { data, meta: m } = await chatJSON(system, user, (d) => journalReviewSchema.parse(d));

  // Phase 2 — focused criteria scoring
  const rubric = [
    { key: "scope_fit", label: "تناسب با محدوده موضوعی مجله" },
    { key: "article_type_fit", label: "تناسب نوع مقاله" },
    { key: "formatting", label: "قالب‌بندی و ساختار" },
    { key: "limits", label: "سقف واژه/منابع" },
    { key: "abstract_structure", label: "ساختار چکیده" },
    { key: "declarations", label: "اعلامیه‌های لازم" },
    { key: "guideline_requirement", label: "الزام راهنمای گزارش‌دهی" },
    { key: "ethics_docs", label: "مدارک اخلاقی" },
  ];
  const criteria = await scoreCriteria("manuscript", text, rubric, meta);
  return { data: { ...data, criteria }, meta: m };
}

// ---------------------------------------------------------------------------
// 6) Multi-reviewer simulation engine
// ---------------------------------------------------------------------------
export async function runReviewerSimulation(
  text: string,
  meta: { title: string; design?: string; language: string; kind: string }
) {
  const system = `تو پنل داوری شبیه‌سازی‌شده‌ای متشکل از چهار داور مستقل هستی:
داور ۱ — کارشناس موضوع (expert): تمرکز بر اهمیت علمی، اصالت، اهمیت بالینی/سلامت عمومی و تفسیر.
داور ۲ — متدولوژیست/اپیدمیولوژیست (methodologist): تمرکز بر طراحی، نمونه‌گیری، سوگیری، مخدوش‌گری و روایی.
داور ۳ — بیواستاتیستین (biostatistician): تمرکز بر حجم نمونه، فرض‌های آماری، تحلیل‌ها و تفسیر آماری.
داور ۴ — سردبیر آکادمیک (editor): تمرکز بر تناسب با مجله، کامل بودن گزارش‌دهی، صداقت علمی و آمادگی انتشار.
${SCIENTIFIC_INTEGRITY_PROMPT}
هر داور مستقل و صرفاً بر اساس سند قضاوت می‌کند؛ اختلاف نظر مصنوعی نساز؛ اگر همه بر نکته‌ای توافق دارند، همان را بنویس. سپس سنتز سردبیری: agreements، disagreements (در صورت وجود؛ در غیر این صورت آرای خالی)، priorities (مشکل‌های اولویت‌دار) و finalRecommendation با explanation.`;

  const user = `جلسه داوری شبیه‌سازی‌شده برای این ${meta.kind === "manuscript" ? "مقاله" : "پروپوزال"}:
عنوان: ${meta.title}
طرح مطالعه: ${meta.design || "نامشخص"}

سند:
"""
${clip(text, 50000)}
"""

ساختار JSON:
{"reviewers": [چهار شیء با role: expert|methodologist|biostatistician|editor و فیلدهای strengths، majorWeaknesses، minorWeaknesses، questionsToAuthors، recommendedCorrections، recommendation (accept|minor_revision|major_revision|reject)، justification], "synthesis": {"agreements": [...], "disagreements": [{"topic", "positions", "resolution"}], "priorities": [...], "finalRecommendation", "explanation"}}`;
  const { data, meta: m } = await chatJSON(system, user, (d) => reviewerSimulationSchema.parse(d));
  return { data, meta: m };
}

// ---------------------------------------------------------------------------
// 7) Two professional reports (authors + editor)
// ---------------------------------------------------------------------------
export async function runReportsGeneration(
  text: string,
  reviewSummary: string,
  meta: { title: string; kind: string; language: string; scores: string }
) {
  const system = `تو سردبیر ارشد مجله هستی که دو گزارش رسمی و کاملاً مجزا تولید می‌کنی:
گزارش A — «نظرات برای نویسندگان»: محترمانه، سازنده، بدون افشای هویت داوران یا نکات محرمانه؛ شامل generalAssessment، strengths، majorConcerns، minorConcerns (هر نگرانی دقیقاً با ساختار 10 جزئی ایراد)، detailedRecommendations و overallAssessment.
گزارش B — «نظرات محرمانه برای سردبیر»: فقط برای هیئت تحریریه؛ شامل scientificMerit، novelty، methodologicalReliability، ethicalIntegrityConcerns، journalSuitability، reasonsForRecommendation، suggestedDecision و confidentialNote.
${SCIENTIFIC_INTEGRITY_PROMPT}
این دو گزارش هرگز نباید نکات محرمانه را با بازخورد نویسندگان ترکیب کنند.`;

  const user = `بر اساس جمع‌بندی داوری زیر دو گزارش رسمی بساز.
عنوان: ${meta.title}
نوع سند: ${meta.kind}
امتیازها: ${meta.scores}

جمع‌بندی داوری قبلی:
${reviewSummary.slice(0, 18000)}

بخش‌هایی از سند (برای استناد محل ایرادها):
"""
${clip(text, 25000)}
"""`;
  const { data, meta: m } = await chatJSON(system, user, (d) => reportsSchema.parse(d));
  return { data, meta: m };
}

// ---------------------------------------------------------------------------
// 8) Revision assistant engine
// ---------------------------------------------------------------------------
export async function runRevisionProposals(text: string, issues: unknown[]) {
  const system = `تو دستیار بازنگری مقاله هستی. برای ایرادهای منتخب، بازنویسی حرفه‌ای متن پیشنهاد می‌کنی.
قوانین الزامی: معنای اصلی و یافته‌های مطالعه را حفظ کن؛ هیچ داده، نتیجه، منبع یا روشی که در سند نیست را اضافه نکن؛ اگر اصلاح نیازمند اطلاعاتی است که نویسنده باید تأمین کند، در متن پیشنهادی با براکت [نیازمند تکمیل توسط نویسنده: ...] مشخص کن؛ در rationale دلیل علمی اصلاح را توضیح بده.
ساختار هر آیتم: issueTitle، severity، originalText (بخش اصلی سند)، problems (نقص‌ها)، revisedText (نسخه بازنویسی‌شده)، rationale.`;

  const user = `ایرادهای شناسایی‌شده (ساختار JSON):
${JSON.stringify(issues).slice(0, 16000)}

بخش‌های مرتبط سند:
"""
${clip(text, 35000)}
"""

برای حداکثر ۱۰ ایراد مهم، پیشنهاد بازنویسی بساز. ساختار JSON: {"items": [...], "notes"}`;
  const { data, meta: m } = await chatJSON(system, user, (d) => revisionProposalSchema.parse(d));
  return { data, meta: m };
}

// ---------------------------------------------------------------------------
// 9) Response-to-reviewers letter
// ---------------------------------------------------------------------------
export async function runResponseLetter(
  comments: string[],
  revisedChanges: string[],
  meta: { title: string; language: string }
) {
  const system = `تو دستیار نویسندگان برای پاسخ به داوران هستی. یک نامه پاسخ حرفه‌ای و محترمانه به‌صورت point-by-point می‌سازی.
قوانین: هیچ ادعایی درباره اصلاح انجام‌شده نکن مگر اینکه در «changesMade» مشخص شده باشد؛ اگر محل تغییر نامعلوم است در location عبارت «(صفحه/سطر پس از نهایی‌سازی تعیین شود)» بگذار؛ لحن علمی و تشکرآمیز؛ زبان فارسی روان.`;

  const user = `عنوان مقاله: ${meta.title}
نظرات داوران:
${comments.map((c, i) => `${i + 1}. ${c}`).join("\n")}

تغییرات انجام‌شده توسط نویسنده (اگر هست):
${revisedChanges.map((c, i) => `${i + 1}. ${c}`).join("\n") || "(هیچ تغییری ثبت نشده — فقط پاسخ برنامه‌ریزی‌شده بنویس و ادعای اصلاح انجام‌شده نکن)"}

ساختار JSON: {"preamble", "responses": [{"comment", "response", "changesMade", "location"}]}`;
  const { data, meta: m } = await chatJSON(system, user, (d) => responseLetterSchema.parse(d));
  return { data, meta: m };
}
