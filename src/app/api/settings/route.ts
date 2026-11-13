import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiStatus } from "@/lib/ai";
import { DEFAULT_PROPOSAL_RUBRIC, DEFAULT_MANUSCRIPT_RUBRIC } from "@/lib/rubrics";

export async function GET() {
  let row = await db.setting.findUnique({ where: { id: "main" } });
  if (!row) {
    row = await db.setting.create({
      data: {
        id: "main",
        proposalWeights: JSON.stringify(DEFAULT_PROPOSAL_RUBRIC),
        manuscriptWeights: JSON.stringify(DEFAULT_MANUSCRIPT_RUBRIC),
      },
    });
  }
  return NextResponse.json({
    proposalWeights: JSON.parse(row.proposalWeights),
    manuscriptWeights: JSON.parse(row.manuscriptWeights),
    language: row.language,
    ai: aiStatus(),
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "بدنه درخواست نامعتبر است." }, { status: 400 });

  const validate = (list: unknown) =>
    Array.isArray(list) &&
    list.every((c: any) => typeof c.key === "string" && typeof c.label === "string" && typeof c.weight === "number");

  const data: any = {};
  if (body.proposalWeights !== undefined) {
    if (!validate(body.proposalWeights)) return NextResponse.json({ error: "ساختار وزن‌های پروپوزال نامعتبر است." }, { status: 400 });
    data.proposalWeights = JSON.stringify(body.proposalWeights);
  }
  if (body.manuscriptWeights !== undefined) {
    if (!validate(body.manuscriptWeights)) return NextResponse.json({ error: "ساختار وزن‌های مقاله نامعتبر است." }, { status: 400 });
    data.manuscriptWeights = JSON.stringify(body.manuscriptWeights);
  }
  if (body.language !== undefined) data.language = String(body.language);

  const row = await db.setting.upsert({
    where: { id: "main" },
    update: data,
    create: {
      id: "main",
      proposalWeights: data.proposalWeights ?? JSON.stringify(DEFAULT_PROPOSAL_RUBRIC),
      manuscriptWeights: data.manuscriptWeights ?? JSON.stringify(DEFAULT_MANUSCRIPT_RUBRIC),
      language: data.language ?? "fa",
    },
  });
  return NextResponse.json({ ok: true, proposalWeights: JSON.parse(row.proposalWeights), manuscriptWeights: JSON.parse(row.manuscriptWeights) });
}
