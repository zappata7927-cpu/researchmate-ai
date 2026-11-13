import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AIConfigError } from "@/lib/ai";
import { runRevisionProposals } from "@/lib/engines/base";
import { runAsync } from "@/lib/jobs";

export const runtime = "nodejs";
export const maxDuration = 600;

// GET /api/projects/[id]/revisions — list
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const revisions = await db.revision.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ revisions });
}

// POST /api/projects/[id]/revisions
// action=generate → AI proposes revisions for the top issues of the latest review
// action=update   → accept/reject/edit a revision row
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "generate");

  const project = await db.project.findUnique({
    where: { id },
    include: { documents: { where: { kind: "main" } }, reviews: { orderBy: { createdAt: "desc" } } },
  });
  if (!project) return NextResponse.json({ error: "پروژه یافت نشد." }, { status: 404 });

  if (action === "update") {
    const { revisionId, status, revisedText } = body || {};
    if (!revisionId) return NextResponse.json({ error: "شناسه بازنگری لازم است." }, { status: 400 });
    const data: any = {};
    if (["accepted", "rejected", "edited", "proposed"].includes(status)) data.status = status;
    if (typeof revisedText === "string") {
      data.revisedText = revisedText;
      data.status = "edited";
    }
    const revision = await db.revision.update({ where: { id: revisionId }, data });
    return NextResponse.json({ ok: true, revision });
  }

  // action=generate
  const text = project.documents
    .map((d) => d.text || "")
    .join("\n\n")
    .trim();
  if (!text) return NextResponse.json({ error: "متنی برای تحلیل وجود ندارد." }, { status: 400 });

  const latest = project.reviews.find((r) => r.engine === "proposal" || r.engine === "manuscript" || r.engine === "stats");
  if (!latest) return NextResponse.json({ error: "برای تولید بازنگری، ابتدا داوری اصلی را اجرا کنید." }, { status: 400 });

  try {
    const rp = JSON.parse(latest.payload);
    const issues: any[] = (rp.issues || []).filter((i: any) => i.severity !== "minor").slice(0, 10);
    if (issues.length === 0) {
      return NextResponse.json({ error: "ایراد مهمی برای تولید بازنگری وجود ندارد." }, { status: 400 });
    }

    async function runGenerateTask(): Promise<{ engine: string; revisions: any[]; notes?: string }> {
      try {
        await db.project.update({ where: { id }, data: { status: "analyzing", statusMessage: "تولید پیشنهادهای بازنگری…" } });
        const { data } = await runRevisionProposals(text, issues);

        const created: any[] = [];
        for (const item of data.items || []) {
          const row = await db.revision.create({
            data: {
              projectId: id,
              issueTitle: item.issueTitle || null,
              originalText: item.originalText || "",
              revisedText: item.revisedText || "",
              rationale: [item.problems ? "نقص‌ها: " + item.problems : "", item.rationale ? "دلیل علمی: " + item.rationale : ""].filter(Boolean).join("\n"),
              status: "proposed",
            },
          });
          created.push(row);
        }
        await db.review.create({
          data: { projectId: id, engine: "revision_plan", payload: JSON.stringify({ notes: data.notes, generated: created.length }) },
        });
        await db.project.update({ where: { id }, data: { status: "ready", statusMessage: null } });
        return { engine: "revision", revisions: created, notes: data.notes };
      } catch (e: any) {
        await db.project.update({ where: { id }, data: { status: "error", statusMessage: String(e?.message || e).slice(0, 300) } }).catch(() => null);
        throw e;
      }
    }

    if (body?.async === true) {
      const { jobId } = runAsync(() => runGenerateTask());
      return NextResponse.json({ jobId }, { status: 202 });
    }

    const result = await runGenerateTask();
    return NextResponse.json(result);
  } catch (e: any) {
    const status = e instanceof AIConfigError ? 503 : 500;
    return NextResponse.json({ error: String(e?.message || e).slice(0, 400) }, { status });
  }
}
