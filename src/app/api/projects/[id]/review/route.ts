import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AIConfigError } from "@/lib/ai";
import { runAsync } from "@/lib/jobs";
import {
  runProposalReview,
  runManuscriptReview,
  runStatsAudit,
  runJournalReview,
  runReviewerSimulation,
  runReportsGeneration,
} from "@/lib/engines/base";
import { rubricFor, DEFAULT_STATS_RUBRIC } from "@/lib/rubrics";
import { scoreReview } from "@/lib/scoring";
import { guidelineForDesign } from "@/lib/guidelines";
import { runClassification } from "@/lib/engines/base";

export const runtime = "nodejs";
export const maxDuration = 600;

type Engine = "proposal" | "manuscript" | "stats" | "journal" | "reviewers" | "reports";

const ENGINES: Engine[] = ["proposal", "manuscript", "stats", "journal", "reviewers", "reports"];

type ProjectRow = NonNullable<Awaited<ReturnType<typeof loadProject>>>;

async function loadProject(id: string) {
  return db.project.findUnique({
    where: { id },
    include: { documents: { orderBy: { createdAt: "asc" } }, reviews: { orderBy: { createdAt: "desc" } } },
  });
}

/**
 * Heavy engine work — executed either inline (legacy sync mode) or in a
 * background job (async mode) so the HTTP response returns immediately and
 * no intermediary proxy can cut it with 502/504.
 */
async function runEngineTask(
  id: string,
  engine: Engine,
  project: ProjectRow,
  text: string
): Promise<{ engine: string; payload: any }> {
  try {
    await db.project.update({ where: { id }, data: { status: "analyzing", statusMessage: "تحلیل هوش مصنوعی در جریان است…" } });

    const settingsRow = await db.setting.findUnique({ where: { id: "main" } });
    const classificationReview = project.reviews.find((r) => r.engine === "classification");
    const meta = {
      title: project.title,
      language: project.language,
      design: classificationReview
        ? ((JSON.parse(classificationReview.payload) as any)?.design as string | undefined)
        : undefined,
    };

    // Auto-classification: manuscript review needs the study design to pick the
    // right reporting guideline. If the user skipped AI classification, run it now.
    let metaDesign: string | undefined = meta.design;
    if (engine === "manuscript" && !metaDesign) {
      try {
        const { data: cls } = await runClassification(text, { docType: project.docType, language: project.language });
        metaDesign = cls.design;
        await db.project.update({ where: { id }, data: { docType: cls.docType, docTypeSource: "ai", language: cls.language } });
        await db.review.create({ data: { projectId: id, engine: "classification", payload: JSON.stringify(cls) } });
      } catch {
        // classification is best-effort; fall back to heuristic docType
        metaDesign = undefined;
      }
    }
    const effectiveMeta = { ...meta, design: metaDesign };

    if (engine === "proposal" || engine === "manuscript") {
      const rubric = rubricFor(engine, engine === "proposal" ? settingsRow?.proposalWeights : settingsRow?.manuscriptWeights ? JSON.parse(settingsRow.manuscriptWeights) : undefined);
      let payload: any;
      if (engine === "proposal") {
        const { data } = await runProposalReview(text, rubric, effectiveMeta);
        payload = data;
      } else {
        const g = guidelineForDesign(metaDesign || project.docType);
        const { data } = await runManuscriptReview(text, rubric, { key: g.key, name: `${g.name} (${g.faName})`, checklist: g.checklist }, effectiveMeta);
        payload = data;
      }
      // transparent scoring
      const score = scoreReview(payload.criteria || [], rubric, payload.issues || [], payload.overallRecommendation);
      await db.review.create({
        data: { projectId: id, engine, payload: JSON.stringify({ ...payload, score }) },
      });
      await db.project.update({
        where: { id },
        data: {
          totalScore: score.total,
          subscores: JSON.stringify(score.perCriterion),
          recommendation: score.recommendation,
          criticalCount: score.counts.critical,
          majorCount: score.counts.major,
          minorCount: score.counts.moderate + score.counts.minor,
          status: "ready",
          statusMessage: null,
          docTypeConfirmed: true,
        },
      });
      return { engine, payload: { ...payload, score } };
    }

    if (engine === "stats") {
      const { data } = await runStatsAudit(text, meta);
      const score = scoreReview(data.criteria || [], DEFAULT_STATS_RUBRIC, data.issues || [], data.overallRecommendation);
      await db.review.create({ data: { projectId: id, engine: "stats", payload: JSON.stringify({ ...data, score }) } });
      await db.project.update({ where: { id }, data: { status: "ready", statusMessage: null } });
      return { engine: "stats", payload: { ...data, score } };
    }

    if (engine === "journal") {
      const { data } = await runJournalReview(text, {
        ...meta,
        journal: project.targetJournal!,
        articleType: project.articleType || undefined,
        field: project.researchField || undefined,
        indexing: undefined,
        wordLimit: undefined,
      });
      await db.review.create({ data: { projectId: id, engine: "journal", payload: JSON.stringify(data) } });
      await db.project.update({ where: { id }, data: { status: "ready", statusMessage: null } });
      return { engine: "journal", payload: data };
    }

    if (engine === "reviewers") {
      const { data } = await runReviewerSimulation(text, { ...meta, kind: project.reviewKind });
      await db.review.create({ data: { projectId: id, engine: "reviewers", payload: JSON.stringify(data) } });
      await db.project.update({ where: { id }, data: { status: "ready", statusMessage: null } });
      return { engine: "reviewers", payload: data };
    }

    // engine === "reports" (pre-checks already validated in POST)
    const latestReview = project.reviews.find((r) => r.engine === "proposal" || r.engine === "manuscript")!;
    const rp = JSON.parse(latestReview.payload);
    const scoresTxt = rp?.score ? `امتیاز کل ${rp.score.total} از 100؛ توصیه ${rp.score.recommendation}` : "بدون امتیاز";
    const summaryTxt = [rp?.summary, ...(rp?.strengths || []).map((s: string) => "نقطه قوت: " + s), ...(rp?.issues || []).map((i: any) => `[${i.severity}] ${i.title}: ${i.explanation}`)]
      .join("\n")
      .slice(0, 18000);
    const { data } = await runReportsGeneration(text, summaryTxt, {
      title: project.title,
      kind: project.reviewKind,
      language: project.language,
      scores: scoresTxt,
    });
    await db.review.create({ data: { projectId: id, engine: "reports", payload: JSON.stringify(data) } });
    await db.project.update({ where: { id }, data: { status: "ready", statusMessage: null } });
    return { engine: "reports", payload: data };
  } catch (e: any) {
    await db.project
      .update({ where: { id }, data: { status: "error", statusMessage: String(e?.message || e).slice(0, 300) } })
      .catch(() => null);
    throw e;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const engine = String(body?.engine || "") as Engine;

  const project = await loadProject(id);
  if (!project) return NextResponse.json({ error: "پروژه یافت نشد." }, { status: 404 });

  const mainDocs = project.documents.filter((d) => d.kind === "main");
  const text = mainDocs
    .map((d) => d.text || "")
    .join("\n\n")
    .trim();
  if (!text) return NextResponse.json({ error: "متنی برای تحلیل وجود ندارد. ابتدا سند قابل استخراج بارگذاری کنید." }, { status: 400 });

  // cheap pre-checks — fail fast with a clear 400 instead of inside the job
  if (!ENGINES.includes(engine)) {
    return NextResponse.json({ error: "موتور ناشناخته: " + engine }, { status: 400 });
  }
  if (engine === "journal" && !project.targetJournal) {
    return NextResponse.json({ error: "برای ارزیابی آمادگی انتشار، ابتدا مجله هدف را در اطلاعات پروژه ثبت کنید." }, { status: 400 });
  }
  if (engine === "reports" && !project.reviews.find((r) => r.engine === "proposal" || r.engine === "manuscript")) {
    return NextResponse.json({ error: "برای تولید گزارش رسمی، ابتدا داوری اصلی (پروپوزال یا مقاله) را اجرا کنید." }, { status: 400 });
  }

  if (body?.async === true) {
    // Async mode: return a job id immediately; the client polls /api/jobs/[id].
    const { jobId } = runAsync(() => runEngineTask(id, engine, project, text));
    return NextResponse.json({ jobId }, { status: 202 });
  }

  // Legacy sync mode (direct API consumers).
  try {
    const result = await runEngineTask(id, engine, project, text);
    return NextResponse.json(result);
  } catch (e: any) {
    const status = e instanceof AIConfigError ? 503 : 500;
    return NextResponse.json({ error: String(e?.message || e).slice(0, 500) }, { status });
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reviews = await db.review.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ reviews: reviews.map((r) => ({ ...r, payload: JSON.parse(r.payload) })) });
}
