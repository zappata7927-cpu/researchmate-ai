import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runClassification } from "@/lib/engines/base";
import { AIConfigError } from "@/lib/ai";
import { runAsync } from "@/lib/jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

async function runClassifyTask(id: string, project: NonNullable<Awaited<ReturnType<typeof loadProject>>>, text: string) {
  try {
    await db.project.update({ where: { id }, data: { status: "analyzing", statusMessage: "در حال تشخیص نوع سند با هوش مصنوعی…" } });
    const { data: classification } = await runClassification(text, { docType: project.docType, language: project.language });
    await db.project.update({
      where: { id },
      data: {
        docType: classification.docType,
        docTypeSource: "ai",
        language: classification.language,
        status: "extracted",
        statusMessage: null,
      },
    });
    const saved = await db.review.create({
      data: { projectId: id, engine: "classification", payload: JSON.stringify(classification) },
    });
    return { classification, reviewId: saved.id };
  } catch (e: any) {
    await db.project.update({ where: { id }, data: { status: "error", statusMessage: String(e?.message || e).slice(0, 300) } }).catch(() => null);
    throw e;
  }
}

async function loadProject(id: string) {
  return db.project.findUnique({
    where: { id },
    include: { documents: { where: { kind: "main" } } },
  });
}

// POST /api/projects/[id]/classify — AI document-type classification
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const project = await loadProject(id);
  if (!project) return NextResponse.json({ error: "پروژه یافت نشد." }, { status: 404 });

  const text = project.documents
    .map((d) => d.text || "")
    .join("\n\n")
    .trim();
  if (!text) return NextResponse.json({ error: "متنی برای تحلیل وجود ندارد." }, { status: 400 });

  if (body?.async === true) {
    const { jobId } = runAsync(() => runClassifyTask(id, project, text));
    return NextResponse.json({ jobId }, { status: 202 });
  }

  try {
    const result = await runClassifyTask(id, project, text);
    return NextResponse.json(result);
  } catch (e: any) {
    const status = e instanceof AIConfigError ? 503 : 500;
    return NextResponse.json({ error: String(e?.message || e).slice(0, 400) }, { status });
  }
}
