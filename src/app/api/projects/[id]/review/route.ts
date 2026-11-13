import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AIConfigError } from "@/lib/ai";
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const engine = String(body?.engine || "") as Engine;

  const project = await db.project.findUnique({
    where: { id },
    include: { documents: { orderBy: { createdAt: "asc" } }, reviews: { orderBy: { createdAt: "desc" } } },
  });
  if (!project) return NextResponse.json({ error: "پروژه یافت نشد." }, { status: 404 });

  const mainDocs = project.documents.filter((d) => d.kind === "main");
  const text = mainDocs
    .map((d) => d.text || "")
    .join("\n\n")
    .trim();
  if (!text) return NextResponse.json({ error: "متنی برای تحلیل وجود ندارد. ابتدا سند قابل استخراج بارگذاری کنید." }, { status: 400 });

  const settingsRow = await db.setting.findUnique({ where: { id: "main" } });
  const meta = {
    title: project.title,
    language: project.language,
    design: project.reviews.find((r) => r.engine === "classification")?.payload
      ? (JSON.parse((project.reviews.find((r) => r.engine === "classification")!.payload) as string)?.design as string)
      : undefined,
  };

  try {
    await db.project.update({ where: { id }, data: { status: "analyzing", statusMessage: "تحلیل هوش مصنوعی در جریان است…" } });

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

    let payload: any = null;
    let engineName = engine;

    if (engine === "proposal" || engine === "manuscript") {
      const rubric = rubricFor(engine, engine === "proposal" ? settingsRow?.proposalWeights : settingsRow?.manuscriptWeights ? JSON.parse(settingsRow.manuscriptWeights) : undefined);
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
        data: { projectId: id, engine: engineName, payload: JSON.stringify({ ...payload, score }) },
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
      return NextResponse.json({ engine: engineName, payload: { ...payload, score } });
    }

    if (engine === "stats") {
      const { data } = await runStatsAudit(text, meta);
      payload = data;
      const score = scoreReview(data.criteria || [], DEFAULT_STATS_RUBRIC, data.issues || [], data.overallRecommendation);
      await db.review.create({ data: { projectId: id, engine: "stats", payload: JSON.stringify({ ...payload, score }) } });
      await db.project.update({ where: { id }, data: { status: "ready", statusMessage: null } });
      return NextResponse.json({ engine: "stats", payload: { ...payload, score } });
    }

    if (engine === "journal") {
      if (!project.targetJournal) {
        return NextResponse.json({ error: "برای ارزیابی آمادگی انتشار، ابتدا مجله هدف را در اطلاعات پروژه ثبت کنید." }, { status: 400 });
      }
      const { data } = await runJournalReview(text, {
        ...meta,
        journal: project.targetJournal,
        articleType: project.articleType || undefined,
        field: project.researchField || undefined,
        indexing: undefined,
        wordLimit: undefined,
      });
      payload = data;
      await db.review.create({ data: { projectId: id, engine: "journal", payload: JSON.stringify(payload) } });
      await db.project.update({ where: { id }, data: { status: "ready", statusMessage: null } });
      return NextResponse.json({ engine: "journal", payload });
    }

    if (engine === "reviewers") {
      const { data } = await runReviewerSimulation(text, { ...meta, kind: project.reviewKind });
      payload = data;
      await db.review.create({ data: { projectId: id, engine: "reviewers", payload: JSON.stringify(payload) } });
      await db.project.update({ where: { id }, data: { status: "ready", statusMessage: null } });
      return NextResponse.json({ engine: "reviewers", payload });
    }

    if (engine === "reports") {
      const latestReview = project.reviews.find((r) => r.engine === "proposal" || r.engine === "manuscript");
      if (!latestReview) {
        return NextResponse.json({ error: "برای تولید گزارش رسمی، ابتدا داوری اصلی (پروپوزال یا مقاله) را اجرا کنید." }, { status: 400 });
      }
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
      payload = data;
      await db.review.create({ data: { projectId: id, engine: "reports", payload: JSON.stringify(payload) } });
      await db.project.update({ where: { id }, data: { status: "ready", statusMessage: null } });
      return NextResponse.json({ engine: "reports", payload });
    }

    return NextResponse.json({ error: "موتور ناشناخته: " + engine }, { status: 400 });
  } catch (e: any) {
    await db.project
      .update({ where: { id }, data: { status: "error", statusMessage: String(e?.message || e).slice(0, 300) } })
      .catch(() => null);
    const status = e instanceof AIConfigError ? 503 : 500;
    return NextResponse.json({ error: String(e?.message || e).slice(0, 500) }, { status });
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reviews = await db.review.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ reviews: reviews.map((r) => ({ ...r, payload: JSON.parse(r.payload) })) });
}
