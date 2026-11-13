/**
 * ResearchMate AI — transparent scoring engine.
 *
 * Each criterion is scored 0..5 by the review engine (null = Not Assessable).
 * Weighted total = sum((score/5) * weight) over assessable criteria
 *                 / sum(weights of assessable criteria) * 100
 *
 * Renormalization only over assessable criteria; the number of assessable
 * criteria is always reported so nothing is silently hidden.
 */

import type { Criterion, Issue } from "./schemas";
import type { RubricCriterion } from "./rubrics";

export interface ScoreResult {
  total: number | null; // 0..100 ; null when nothing assessable
  assessable: number;
  notAssessable: number;
  totalCriteria: number;
  perCriterion: { key: string; label: string; weight: number; score: number | null; weighted: number | null }[];
  counts: { critical: number; major: number; moderate: number; minor: number };
  hasCriticalProblem: boolean;
  recommendation: string;
}

export const RECOMMENDATION_FA: Record<string, string> = {
  accept: "پذیرش",
  minor_revision: "پذیرش با بازنگری جزئی",
  major_revision: "بازنگری اساسی (ماژور)",
  reject: "رد",
  not_assessable: "غیرقابل ارزیابی با اطلاعات موجود",
  ready: "آماده ارسال",
  high_rejection_risk: "ریسک بالای رد",
  insufficient_info: "اطلاعات ناکافی برای داوری",
};

export function scoreReview(
  criteria: Criterion[],
  rubric: RubricCriterion[],
  issues: Issue[],
  engineRecommendation?: string
): ScoreResult {
  const weightByKey = new Map(rubric.map((r) => [r.key, r]));
  const perCriterion: ScoreResult["perCriterion"] = [];
  let gained = 0;
  let possible = 0;
  let assessable = 0;
  let notAssessable = 0;

  for (const c of criteria) {
    const r = weightByKey.get(c.key);
    const weight = r?.weight ?? 0;
    const label = r?.label ?? c.label ?? c.key;
    if (c.score === null || c.score === undefined || Number.isNaN(c.score)) {
      perCriterion.push({ key: c.key, label, weight, score: null, weighted: null });
      notAssessable++;
      continue;
    }
    const weighted = (c.score / 5) * weight;
    perCriterion.push({ key: c.key, label, weight, score: c.score, weighted });
    gained += weighted;
    possible += weight;
    assessable++;
  }

  const total = assessable > 0 && possible > 0 ? Math.round((gained / possible) * 1000) / 10 : null;

  const counts = { critical: 0, major: 0, moderate: 0, minor: 0 };
  for (const i of issues) {
    if (i.severity in counts) counts[i.severity as keyof typeof counts]++;
  }
  const hasCriticalProblem = counts.critical > 0 || issues.some((i) => i.severity === "critical");

  let recommendation = engineRecommendation || "major_revision";
  // A critical problem must surface independently of the average:
  if (hasCriticalProblem && (recommendation === "accept" || recommendation === "minor_revision")) {
    recommendation = "major_revision";
  }

  return {
    total,
    assessable,
    notAssessable,
    totalCriteria: criteria.length,
    perCriterion,
    counts,
    hasCriticalProblem,
    recommendation,
  };
}

export function scoreBand(total: number | null): { label: string; color: string } {
  if (total === null) return { label: "غیرقابل ارزیابی", color: "#64748b" };
  if (total >= 85) return { label: "عالی", color: "#0f766e" };
  if (total >= 70) return { label: "خوب", color: "#0891b2" };
  if (total >= 55) return { label: "قابل قبول", color: "#d97706" };
  if (total >= 40) return { label: "ضعیف", color: "#ea580c" };
  return { label: "بسیار ضعیف", color: "#dc2626" };
}
