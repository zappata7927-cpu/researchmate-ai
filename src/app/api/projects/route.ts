import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractDocument, heuristicClassify } from "@/lib/extract";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 300;

const UPLOAD_ROOT = path.join(process.cwd(), "db", "uploads");
const MAX_FILE = 30 * 1024 * 1024; // 30MB

// GET /api/projects?q=... — list with search
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  const projects = await db.project.findMany({
    where: q ? { OR: [{ title: { contains: q } }, { docType: { contains: q } }] } : {},
    orderBy: { createdAt: "desc" },
    include: { documents: { select: { id: true, name: true, kind: true, status: true, pages: true, size: true } }, reviews: { select: { id: true, engine: true, createdAt: true } } },
  });
  return NextResponse.json({ projects });
}

// POST /api/projects — multipart create with files
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const title = String(form.get("title") || "").trim() || "سند بدون عنوان";
    const reviewKind = String(form.get("reviewKind") || "proposal") === "manuscript" ? "manuscript" : "proposal";
    const targetJournal = String(form.get("targetJournal") || "").trim() || null;
    const articleType = String(form.get("articleType") || "").trim() || null;
    const researchField = String(form.get("researchField") || "").trim() || null;
    const indexing = String(form.get("indexing") || "").trim() || null;
    const wordLimitRaw = String(form.get("wordLimit") || "").trim();
    const wordLimit = wordLimitRaw ? Number(wordLimitRaw) : null;

    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "حداقل یک فایل سند اصلی لازم است." }, { status: 400 });
    }

    const project = await db.project.create({
      data: {
        title,
        reviewKind,
        targetJournal,
        articleType,
        researchField,
        status: "extracting",
        statusMessage: "در حال استخراج متن اسناد…",
      },
    });

    const docResults: any[] = [];
    let mainText = "";
    let supTexts: string[] = [];

    await fs.mkdir(path.join(UPLOAD_ROOT, project.id), { recursive: true });

    for (const f of files) {
      if (f.size > MAX_FILE) {
        docResults.push({ name: f.name, status: "failed", notes: `حجم فایل بیش از حد مجاز (۳۰ مگابایت) است.` });
        continue;
      }
      const buf = Buffer.from(await f.arrayBuffer());
      // save original for future re-processing / download
      const safeName = f.name.replace(/[^\p{L}\p{N}._ -]/gu, "_");
      await fs.writeFile(path.join(UPLOAD_ROOT, project.id, safeName), buf);

      const isSupplementary = /\.(xlsx|xls)$/i.test(f.name);
      const ext = await extractDocument(f.name, f.type, buf);
      await db.document.create({
        data: {
          projectId: project.id,
          name: f.name,
          kind: isSupplementary ? "supplementary" : "main",
          mime: f.type || "application/octet-stream",
          size: f.size,
          pages: ext.pages,
          language: ext.language,
          text: ext.text,
          notes: ext.notes || null,
          status: ext.status,
        },
      });
      docResults.push({
        name: f.name,
        status: ext.status,
        pages: ext.pages,
        language: ext.language,
        notes: ext.notes,
        chars: ext.text.length,
      });
      if (ext.status === "ok" || ext.status === "partial") {
        if (isSupplementary) supTexts.push(ext.text);
        else mainText += (mainText ? "\n\n" : "") + `【فایل: ${f.name}】\n` + ext.text;
      }
    }

    const mainOk = docResults.some((d) => (d.status === "ok" || d.status === "partial") && d.chars > 50);
    if (!mainOk) {
      await db.project.update({
        where: { id: project.id },
        data: {
          status: "error",
          statusMessage:
            "هیچ متنی از اسناد اصلی استخراج نشد. لطفاً فایل PDF متنی یا DOCX بارگذاری کنید. جزئیات در فهرست فایل‌ها آمده است.",
        },
      });
      return NextResponse.json(
        {
          error:
            "هیچ متنی از اسناد اصلی استخراج نشد. لطفاً فایل PDF متنی (غیر اسکن) یا DOCX بارگذاری کنید. فایل‌های اسکن‌شده به OCR نیاز دارند که در این نسخه پشتیبانی نمی‌شود.",
          projectId: project.id,
          documents: docResults,
        },
        { status: 422 }
      );
    }

    const heuristic = heuristicClassify(mainText);
    const fullText = supTexts.length ? mainText + "\n\n" + supTexts.join("\n\n") : mainText;

    const updated = await db.project.update({
      where: { id: project.id },
      data: {
        docType: heuristic.docType,
        docTypeSource: "heuristic",
        language: heuristic.language,
        status: "extracted",
        statusMessage: null,
      },
    });

    return NextResponse.json({ project: updated, documents: docResults, textLength: fullText.length });
  } catch (e: any) {
    console.error("project create error", e);
    return NextResponse.json({ error: "خطا در ایجاد پروژه: " + String(e?.message || e).slice(0, 200) }, { status: 500 });
  }
}
