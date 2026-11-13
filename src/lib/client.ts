/** Client-side helpers for ResearchMate AI UI */

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const msg = body?.error || `خطای شبکه (${res.status})`;
    const err = new Error(msg) as any;
    err.status = res.status;
    throw err;
  }
  return body as T;
}

export function faNum(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  return String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

export function faDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return String(d);
  }
}

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
  minor: "جزئی",
};

export const SEVERITY_COLOR: Record<string, string> = {
  critical: "#dc2626",
  major: "#ea580c",
  moderate: "#d97706",
  minor: "#64748b",
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

export const REF_STATUS_FA: Record<string, { label: string; color: string }> = {
  verified: { label: "تأییدشده", color: "#0f766e" },
  partial: { label: "تأیید جزئی", color: "#0891b2" },
  wrong_metadata: { label: "متادیتای ناهمخوان", color: "#ea580c" },
  doi_not_found: { label: "DOI یافت نشد", color: "#d97706" },
  possibly_retracted: { label: "احتمال Retraction", color: "#dc2626" },
  unverified: { label: "راستی‌آزمایی نشد", color: "#64748b" },
};

export const DOC_STATUS_FA: Record<string, { label: string; color: string }> = {
  pending: { label: "در انتظار", color: "#64748b" },
  ok: { label: "استخراج موفق", color: "#0f766e" },
  partial: { label: "استخراج ناقص", color: "#d97706" },
  failed: { label: "استخراج ناموفق", color: "#dc2626" },
  unsupported: { label: "قالب پشتیبانی‌نشده", color: "#dc2626" },
};
