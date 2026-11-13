import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runClassification } from "@/lib/engines/base";
import { AIConfigError } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/projects/[id]/classify — AI document-type classification
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: { documents: { where: { kind: "main" } } },
  });
  if (!project) return NextResponse.json({ error: "پروژه یافت نشد." }, { status: 404 });

  const text = project.documents
    .map((d) => d.text || "")
    .join("\n\n")
    .trim();
  if (!text) return NextResponse.json({ error: "متنی برای تحلیل وجود ندارد." }, { status: 400 });

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
    return NextResponse.json({ classification, reviewId: saved.id });
  } catch (e: any) {
    await db.project.update({ where: { id }, data: { status: "error", statusMessage: String(e?.message || e).slice(0, 300) } }).catch(() => null);
    const status = e instanceof AIConfigError ? 503 : 500;
    return NextResponse.json({ error: String(e?.message || e).slice(0, 400) }, { status });
  }
}
