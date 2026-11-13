import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AIConfigError } from "@/lib/ai";
import { runResponseLetter } from "@/lib/engines/base";

export const runtime = "nodejs";
export const maxDuration = 600;

// POST /api/projects/[id]/response-letter
// Generates a professional point-by-point response. Never claims a revision
// happened unless the corresponding revision was actually accepted/edited.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const extraComments: string[] = Array.isArray(body?.comments) ? body.comments.filter((c: any) => typeof c === "string" && c.trim()) : [];

  const project = await db.project.findUnique({
    where: { id },
    include: { reviews: { orderBy: { createdAt: "desc" } }, revisions: { orderBy: { createdAt: "desc" } } },
  });
  if (!project) return NextResponse.json({ error: "پروژه یافت نشد." }, { status: 404 });

  const latest = project.reviews.find((r) => r.engine === "proposal" || r.engine === "manuscript");
  if (!latest && extraComments.length === 0) {
    return NextResponse.json({ error: "هیچ دیدگاه داوری برای پاسخ وجود ندارد؛ ابتدا داوری را اجرا کنید یا نظرات داوران را دستی وارد کنید." }, { status: 400 });
  }

  // comments to answer: issues from latest review + user-provided extra comments
  const comments: string[] = [];
  if (latest) {
    const rp = JSON.parse(latest.payload);
    for (const i of rp.issues || []) {
      comments.push(`${i.title} (شدت: ${i.severity}) — ${i.explanation || ""}`.slice(0, 600));
    }
  }
  comments.push(...extraComments.slice(0, 20));

  // changes actually accepted by the author (real, recorded revisions only)
  const accepted = project.revisions.filter((r) => r.status === "accepted" || r.status === "edited");
  const changesMade = accepted.map((r) => `${r.issueTitle || "اصلاح"}: ${r.revisedText.slice(0, 400)}`);

  try {
    const { data } = await runResponseLetter(comments.slice(0, 25), changesMade, {
      title: project.title,
      language: project.language,
    });
    // honest note about what has/has not been applied
    const payload = {
      ...data,
      meta: {
        appliedRevisions: accepted.length,
        totalIssues: comments.length,
        honestyNote:
          accepted.length === 0
            ? "هیچ بازنگری‌ای تاکنون در بخش «دستیار بازنگری» پذیرفته نشده است؛ پاسخ‌های تولیدشده برنامه‌ریزی پاسخ هستند و ادعای اصلاح انجام‌شده نمی‌کنند."
            : `${accepted.length} بازنگری پذیرفته‌شده در نامه لحاظ شد. برای مابقی ایرادها، اصلاح را در دستیار بازنگری بپذیرید و نامه را دوباره بسازید.`,
      },
    };
    await db.review.create({ data: { projectId: id, engine: "response_letter", payload: JSON.stringify(payload) } });
    return NextResponse.json({ engine: "response_letter", payload });
  } catch (e: any) {
    const status = e instanceof AIConfigError ? 503 : 500;
    return NextResponse.json({ error: String(e?.message || e).slice(0, 400) }, { status });
  }
}
