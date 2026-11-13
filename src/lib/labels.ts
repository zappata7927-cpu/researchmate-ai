/** Shared Persian labels used across API and UI. */

export const DOC_TYPE_FA: Record<string, string> = {
  proposal: "پروپوزال پژوهشی",
  manuscript: "مقاله علمی",
  protocol: "پروتکل مطالعه",
  systematic_review: "مرور نظام‌مند / متاآنالیز",
  case_report: "گزارش مورد",
  thesis: "پایان‌نامه",
  other: "سند پژوهشی دیگر",
  unknown: "نامشخص",
};

export const SEVERITY_FA: Record<string, string> = {
  critical: "بحرانی",
  major: "اساسی (ماژور)",
  moderate: "متوسط",
  minor: "جزئی (مینور)",
};

export const CATEGORY_FA: Record<string, string> = {
  methodological: "روش‌شناختی",
  statistical: "آماری",
  reasoning: "استدلال علمی",
  ethical: "اخلاقی",
  reporting: "گزارش‌دهی",
  reference: "منابع",
  language: "نگارش و ساختار",
  publication: "تناسب انتشار",
};

export const RECOMMENDATION_FA: Record<string, string> = {
  accept: "پذیرش",
  minor_revision: "پذیرش با بازنگری جزئی",
  major_revision: "بازنگری اساسی (ماژور)",
  reject: "رد",
  not_assessable: "غیرقابل ارزیابی",
  ready: "آماده ارسال",
  high_rejection_risk: "ریسک بالای رد",
  insufficient_info: "اطلاعات ناکافی برای داوری",
};
