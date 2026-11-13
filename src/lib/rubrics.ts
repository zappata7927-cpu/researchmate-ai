/**
 * ResearchMate AI — default scoring rubrics (configurable via Settings).
 * Weights sum to 100 for each review kind.
 */

export interface RubricCriterion {
  key: string;
  label: string;
  weight: number;
}

export const DEFAULT_PROPOSAL_RUBRIC: RubricCriterion[] = [
  { key: "significance", label: "اهمیت و ضرورت پژوهش", weight: 10 },
  { key: "innovation", label: "نوآوری و اصالت", weight: 10 },
  { key: "literature", label: "مرور ادبیات", weight: 8 },
  { key: "objectives", label: "اهداف و فرضیه‌ها", weight: 8 },
  { key: "methodology", label: "روش‌شناسی پژوهش", weight: 15 },
  { key: "sampling", label: "نمونه‌گیری و حجم نمونه", weight: 10 },
  { key: "instruments", label: "ابزارهای سنجش", weight: 8 },
  { key: "statistics", label: "تحلیل آماری", weight: 10 },
  { key: "ethics", label: "ملاحظات اخلاقی", weight: 7 },
  { key: "feasibility", label: "امکان‌پذیری و بودجه", weight: 7 },
  { key: "writing", label: "منابع و نگارش علمی", weight: 7 },
];

export const DEFAULT_MANUSCRIPT_RUBRIC: RubricCriterion[] = [
  { key: "title_abstract", label: "عنوان و چکیده", weight: 5 },
  { key: "significance", label: "اهمیت و اصالت", weight: 10 },
  { key: "introduction", label: "مقدمه و پیشینه", weight: 8 },
  { key: "methodology", label: "طرح مطالعه و روش‌شناسی", weight: 18 },
  { key: "sampling", label: "نمونه‌گیری و حجم نمونه", weight: 8 },
  { key: "instruments", label: "ابزارها و اندازه‌گیری", weight: 7 },
  { key: "statistics", label: "تحلیل آماری", weight: 12 },
  { key: "results", label: "یافته‌ها", weight: 8 },
  { key: "discussion", label: "بحث و تفسیر", weight: 10 },
  { key: "limitations", label: "محدودیت‌ها و تعمیم‌پذیری", weight: 4 },
  { key: "ethics", label: "اخلاق و شفافیت", weight: 5 },
  { key: "writing", label: "منابع و نگارش", weight: 5 },
];

export const PROPOSAL_DOMAINS = [
  "title_problem",
  "significance",
  "literature",
  "objectives",
  "methodology",
  "instruments",
  "statistics",
  "ethics",
  "feasibility",
  "references",
] as const;

export const MANUSCRIPT_SECTIONS = [
  "title_abstract",
  "introduction",
  "methods",
  "results",
  "discussion",
  "conclusion",
  "tables_figures",
  "integrity",
  "references",
] as const;

export const DEFAULT_STATS_RUBRIC: RubricCriterion[] = [
  { key: "test_fit", label: "تناسب آزمون/مدل با سؤال و طرح", weight: 15 },
  { key: "assumptions", label: "بررسی فرض‌های آماری", weight: 12 },
  { key: "sample_size", label: "حجم نمونه و توان آماری", weight: 15 },
  { key: "confounding", label: "کنترل مخدوش‌گرها و سوگیری‌ها", weight: 14 },
  { key: "missing_data", label: "مدیریت داده گمشده", weight: 10 },
  { key: "effect_reporting", label: "اندازه اثر، فاصله اطمینان و p", weight: 12 },
  { key: "consistency", label: "سازگاری جداول/شکل‌ها با متن", weight: 10 },
  { key: "conclusion_fit", label: "توجیه‌پذیری نتیجه‌گیری", weight: 12 },
];

export function rubricFor(kind: string, custom?: unknown): RubricCriterion[] {
  const base = kind === "manuscript" ? DEFAULT_MANUSCRIPT_RUBRIC : DEFAULT_PROPOSAL_RUBRIC;
  if (Array.isArray(custom) && custom.length > 0) {
    // merge custom weights by key, keeping labels/keys from base
    const customMap = new Map<string, number>();
    for (const c of custom as any[]) {
      if (c && typeof c.key === "string" && typeof c.weight === "number") {
        customMap.set(c.key, c.weight);
      }
    }
    return base.map((c) => (customMap.has(c.key) ? { ...c, weight: customMap.get(c.key)! } : c));
  }
  return base;
}
