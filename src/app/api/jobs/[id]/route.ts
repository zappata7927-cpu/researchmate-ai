import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";

export const runtime = "nodejs";

// GET /api/jobs/[id] — poll an async job started by any long-running route.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) {
    return NextResponse.json(
      {
        done: true,
        error: "کار یافت نشد (سرور احتمالاً راه‌اندازی مجدد شده است). لطفاً دوباره تلاش کنید.",
      },
      { status: 404 }
    );
  }
  return NextResponse.json({ done: job.done, error: job.error ?? null, payload: job.payload ?? null });
}
