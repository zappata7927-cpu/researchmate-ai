/**
 * ResearchMate AI — structured output schemas (zod).
 * All AI engines return data validated by these schemas so downstream
 * rendering/scoring never breaks on inconsistent model output.
 */
import { z } from "zod";

export const SEVERITIES = ["critical", "major", "moderate", "minor"] as const;
export const CATEGORIES = [
  "methodological",
  "statistical",
  "reasoning",
  "ethical",
  "reporting",
  "reference",
  "language",
  "publication",
] as const;

export const severitySchema = z.enum(SEVERITIES).catch("moderate");
export const categorySchema = z.enum(CATEGORIES).catch("reporting");

export const issueSchema = z.object({
  title: z.string().catch("بدون عنوان"),
  category: categorySchema,
  severity: severitySchema,
  location: z.string().catch("—"),
  excerpt: z.string().catch(""),
  explanation: z.string().catch(""),
  whyMatters: z.string().catch(""),
  suggestion: z.string().catch(""),
  detailedSolution: z.string().catch(""),
  suggestedText: z.string().optional().nullable().catch(null),
  guideline: z.string().optional().nullable().catch(null),
});
export type Issue = z.infer<typeof issueSchema>;

/** Tolerant number: accepts "3", 3, null, "null" → number|null */
const scoreNum = z
  .preprocess(
    (v) => {
      if (v === null || v === undefined) return null;
      if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (s === "null" || s === "na" || s === "") return null;
        const n = Number(s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
        return Number.isNaN(n) ? null : n;
      }
      return v;
    },
    z.number().min(0).max(5).nullable()
  )
  .catch(null);

const tolerantNum = z
  .preprocess((v) => {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = Number(v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
      return Number.isNaN(n) ? 0 : n;
    }
    return 0;
  }, z.number())
  .catch(0);

export const criterionSchema = z.object({
  key: z.string().catch("unknown"),
  label: z.string().catch(""),
  score: scoreNum,
  justification: z.string().catch(""),
  missingInfo: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
});
export type Criterion = z.infer<typeof criterionSchema>;

export const guidelineItemSchema = z.object({
  item: z.string().catch(""),
  status: z.enum(["reported", "partial", "missing", "na"]).catch("na"),
  location: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),
});
export type GuidelineItem = z.infer<typeof guidelineItemSchema>;

export const classificationSchema = z.object({
  docType: z.enum([
    "proposal",
    "manuscript",
    "protocol",
    "systematic_review",
    "case_report",
    "thesis",
    "other",
  ]),
  confidence: tolerantNum.catch(0.5),
  language: z.enum(["fa", "en", "mixed"]).catch("fa"),
  design: z.string().catch(""),
  suggestedGuideline: z.string().optional().nullable().catch(null),
  rationale: z.string().catch(""),
});
export type Classification = z.infer<typeof classificationSchema>;

export const reviewCoreSchema = z.object({
  summary: z.string().catch(""),
  strengths: z.array(z.string()).catch([]),
  criteria: z.array(criterionSchema).catch([]),
  issues: z.array(issueSchema).catch([]),
  overallRecommendation: z
    .enum(["accept", "minor_revision", "major_revision", "reject", "not_assessable"])
    .catch("major_revision"),
  recommendationExplanation: z.string().catch(""),
  criticalFlags: z.array(z.string()).catch([]),
});
export type ReviewCore = z.infer<typeof reviewCoreSchema>;

/** Scoring-only call: criteria array for the rubric */
export const criteriaOnlySchema = z.object({
  criteria: z.array(criterionSchema).catch([]),
});
export type CriteriaOnly = z.infer<typeof criteriaOnlySchema>;

/** Guideline compliance + criteria (manuscript scoring call) */
export const manuscriptScoringSchema = criteriaOnlySchema.extend({
  guideline: z
    .object({
      key: z.string().catch(""),
      name: z.string().catch(""),
      complianceScore: tolerantNum.catch(0),
      items: z.array(guidelineItemSchema).catch([]),
    })
    .optional()
    .nullable(),
});

export const manuscriptReviewSchema = reviewCoreSchema.extend({
  guideline: z
    .object({
      key: z.string().catch(""),
      name: z.string().catch(""),
      complianceScore: tolerantNum.catch(0),
      items: z.array(guidelineItemSchema).catch([]),
    })
    .optional()
    .nullable(),
});
export type ManuscriptReview = z.infer<typeof manuscriptReviewSchema>;

export const statsAuditSchema = z.object({
  summary: z.string().catch(""),
  criteria: z.array(criterionSchema).catch([]),
  issues: z.array(issueSchema).catch([]),
  // Each finding: exact location, problem, why it matters, correction, alternative test, corrected reporting example
  findings: z
    .array(
      z.object({
        location: z.string().catch("—"),
        excerpt: z.string().catch(""),
        problem: z.string().catch(""),
        whyItMatters: z.string().catch(""),
        correction: z.string().catch(""),
        alternativeMethod: z.string().optional().nullable(),
        correctedReportingExample: z.string().optional().nullable(),
      })
    )
    .catch([]),
  needsRawData: z.array(z.string()).catch([]),
  overallRecommendation: z
    .enum(["accept", "minor_revision", "major_revision", "reject", "not_assessable"])
    .catch("major_revision"),
});
export type StatsAudit = z.infer<typeof statsAuditSchema>;

export const referenceCheckSchema = z.object({
  raw: z.string().catch(""),
  status: z
    .enum(["verified", "partial", "wrong_metadata", "doi_not_found", "possibly_retracted", "unverified"])
    .catch("unverified"),
  foundTitle: z.string().optional().nullable(),
  foundAuthors: z.string().optional().nullable(),
  foundJournal: z.string().optional().nullable(),
  foundYear: z.string().optional().nullable(),
  doi: z.string().optional().nullable(),
  pmid: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  retracted: z.boolean().catch(false),
  note: z.string().optional().nullable(),
});
export type ReferenceCheck = z.infer<typeof referenceCheckSchema>;

export const referencesAuditSchema = z.object({
  summary: z.string().catch(""),
  totalFound: tolerantNum.catch(0),
  references: z.array(
    z.object({
      index: z.number(),
      raw: z.string().catch(""),
      relevance: z.string().catch(""), // relevance to cited claim (AI judgement, may be "—")
      check: referenceCheckSchema.optional().nullable(),
    })
  ),
  issues: z.array(issueSchema).catch([]),
});
export type ReferencesAudit = z.infer<typeof referencesAuditSchema>;

export const journalReviewSchema = z.object({
  summary: z.string().catch(""),
  criteria: z.array(criterionSchema).catch([]),
  readinessScore: tolerantNum.catch(0),
  recommendation: z
    .enum([
      "ready",
      "minor_revision",
      "major_revision",
      "high_rejection_risk",
      "insufficient_info",
    ])
    .catch("insufficient_info"),
  recommendationExplanation: z.string().catch(""),
  scopeFit: z.string().catch(""),
  formattingIssues: z.array(issueSchema).catch([]),
  missingDeclarations: z.array(z.string()).catch([]),
  uncertaintyNote: z.string().catch(""),
});
export type JournalReview = z.infer<typeof journalReviewSchema>;

export const reviewerReportSchema = z.object({
  role: z.enum(["expert", "methodologist", "biostatistician", "editor"]),
  strengths: z.array(z.string()).catch([]),
  majorWeaknesses: z.array(z.string()).catch([]),
  minorWeaknesses: z.array(z.string()).catch([]),
  questionsToAuthors: z.array(z.string()).catch([]),
  recommendedCorrections: z.array(z.string()).catch([]),
  recommendation: z
    .enum(["accept", "minor_revision", "major_revision", "reject"])
    .catch("major_revision"),
  justification: z.string().catch(""),
});
export type ReviewerReport = z.infer<typeof reviewerReportSchema>;

export const reviewerSimulationSchema = z.object({
  reviewers: z.array(reviewerReportSchema).catch([]),
  synthesis: z.object({
    agreements: z.array(z.string()).catch([]),
    disagreements: z
      .array(
        z.object({
          topic: z.string().catch(""),
          positions: z.string().catch(""),
          resolution: z.string().catch(""),
        })
      )
      .catch([]),
    priorities: z.array(z.string()).catch([]),
    finalRecommendation: z
      .enum(["accept", "minor_revision", "major_revision", "reject"])
      .catch("major_revision"),
    explanation: z.string().catch(""),
  }),
});
export type ReviewerSimulation = z.infer<typeof reviewerSimulationSchema>;

export const reportsSchema = z.object({
  reportA: z.object({
    generalAssessment: z.string().catch(""),
    strengths: z.array(z.string()).catch([]),
    majorConcerns: z.array(issueSchema).catch([]),
    minorConcerns: z.array(issueSchema).catch([]),
    detailedRecommendations: z.array(z.string()).catch([]),
    overallAssessment: z.string().catch(""),
  }),
  reportB: z.object({
    scientificMerit: z.string().catch(""),
    novelty: z.string().catch(""),
    methodologicalReliability: z.string().catch(""),
    ethicalIntegrityConcerns: z.string().catch(""),
    journalSuitability: z.string().catch(""),
    reasonsForRecommendation: z.array(z.string()).catch([]),
    suggestedDecision: z
      .enum(["accept", "minor_revision", "major_revision", "reject", "not_assessable"])
      .catch("major_revision"),
    confidentialNote: z.string().catch(""),
  }),
});
export type ReportsPayload = z.infer<typeof reportsSchema>;

export const revisionProposalSchema = z.object({
  items: z
    .array(
      z.object({
        issueTitle: z.string().catch(""),
        severity: severitySchema.catch("moderate"),
        originalText: z.string().catch(""),
        problems: z.string().catch(""),
        revisedText: z.string().catch(""),
        rationale: z.string().catch(""),
      })
    )
    .catch([]),
  notes: z.string().catch(""),
});
export type RevisionProposal = z.infer<typeof revisionProposalSchema>;

export const responseLetterSchema = z.object({
  preamble: z.string().catch(""),
  responses: z
    .array(
      z.object({
        comment: z.string().catch(""),
        response: z.string().catch(""),
        changesMade: z.string().catch(""),
        location: z.string().optional().nullable(),
      })
    )
    .catch([]),
});
export type ResponseLetter = z.infer<typeof responseLetterSchema>;
