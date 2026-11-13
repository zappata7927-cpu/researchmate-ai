import { NextResponse } from "next/server";
import { aiStatus } from "@/lib/ai";

export async function GET() {
  const s = aiStatus();
  return NextResponse.json({
    ok: true,
    app: "ResearchMate AI | پژوهش‌یار هوشمند",
    ai: s,
    time: new Date().toISOString(),
  });
}
