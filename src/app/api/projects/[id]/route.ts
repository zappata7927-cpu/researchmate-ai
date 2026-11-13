import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/projects/[id] — full project with documents, reviews, revisions
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { createdAt: "asc" } },
      reviews: { orderBy: { createdAt: "desc" } },
      revisions: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!project) return NextResponse.json({ error: "پروژه یافت نشد." }, { status: 404 });
  const reviews = project.reviews.map((r) => ({ ...r, payload: JSON.parse(r.payload) }));
  return NextResponse.json({ ...project, reviews });
}

// PATCH /api/projects/[id] — rename / confirm type / journal meta
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "بدنه درخواست نامعتبر است." }, { status: 400 });
  const data: any = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body.docType === "string") {
    data.docType = body.docType;
    data.docTypeSource = "user";
    data.docTypeConfirmed = true;
  }
  if (typeof body.reviewKind === "string") data.reviewKind = body.reviewKind === "manuscript" ? "manuscript" : "proposal";
  if (typeof body.targetJournal === "string") data.targetJournal = body.targetJournal.trim() || null;
  if (typeof body.articleType === "string") data.articleType = body.articleType.trim() || null;
  if (typeof body.researchField === "string") data.researchField = body.researchField.trim() || null;
  const project = await db.project.update({ where: { id }, data });
  return NextResponse.json({ ok: true, project });
}

// DELETE /api/projects/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.project.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
