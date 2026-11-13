"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BookOpenCheck,
  Calculator,
  FileEdit,
  FileText,
  FlaskConical,
  Newspaper,
  Send,
  UploadCloud,
  FileWarning,
  CheckCircle2,
  Sparkles,
  ScanText,
} from "lucide-react";
import { api, DOC_STATUS_FA } from "@/lib/client";
import { LoadingPanel, Banner, StatusChip } from "./ui-bits";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type NewMode = "proposal" | "manuscript" | "stats" | "references" | "journal" | "reviewers" | "revision";

const MODE_META: Record<NewMode, { title: string; desc: string; icon: React.ReactNode; cta: string; engine: string }> = {
  proposal: { title: "داوری پروپوزال پژوهشی", desc: "ارزیابی جامع ۱۱ بُعدی پروپوزال: بیان مسئله، نوآوری، ادبیات، اهداف، روش‌شناسی، ابزار، آمار، اخلاق، امکان‌پذیری و نگارش با روبریک ۱۰۰ امتیازی قابل تنظیم.", icon: <FileText className="h-5 w-5" />, cta: "شروع داوری کامل پروپوزال", engine: "proposal" },
  manuscript: { title: "داوری مقاله علمی", desc: "داوری کامل مقاله به‌همراه انتخاب خودکار راهنمای گزارش‌دهی (CONSORT، STROBE، PRISMA و…) و ارزیابی مستقل کیفیت روش‌شناسی و کامل بودن گزارش.", icon: <Newspaper className="h-5 w-5" />, cta: "شروع داوری کامل مقاله", engine: "manuscript" },
  stats: { title: "ممیزی آماری و روش‌شناختی", desc: "بررسی تخصصی تناسب آزمون‌های آماری، فرض‌ها، حجم نمونه و توان، کنترل مخدوش‌گری، داده گمشده و سازگاری جداول با متن.", icon: <Calculator className="h-5 w-5" />, cta: "اجرای ممیزی آماری", engine: "stats" },
  references: { title: "بررسی و راستی‌آزمایی منابع", desc: "استخراج فهرست منابع و راستی‌آزمایی هر مورد در پایگاه‌های واقعی Crossref، OpenAlex و PubMed؛ کشف DOI نادرست و نشانه‌های Retraction.", icon: <BookOpenCheck className="h-5 w-5" />, cta: "شروع راستی‌آزمایی منابع", engine: "references" },
  journal: { title: "ارزیابی آمادگی انتشار", desc: "تطبیق سند با الزامات مجله هدف: محدوده موضوعی، نوع مقاله، قالب‌بندی، سقف واژه، اعلامیه‌های لازم و الزام راهنمای گزارش‌دهی.", icon: <Send className="h-5 w-5" />, cta: "ارزیابی آمادگی انتشار", engine: "journal" },
  reviewers: { title: "شبیه‌سازی پنل داوران", desc: "چهار داور مستقل (کارشناس موضوع، متدولوژیست، بیواستاتیستین، سردبیر) هرکدام با نقاط قوت/ضعف و پرسش‌های از نویسندگان + سنتز سردبیری.", icon: <FlaskConical className="h-5 w-5" />, cta: "اجرای جلسه داوری شبیه‌سازی‌شده", engine: "reviewers" },
  revision: { title: "دستیار بازنگری مقاله", desc: "برای ایرادهای مهم، بازنویسی حرفه‌ای متن با حفظ کامل یافته‌ها؛ پذیرش/رد/ویرایش هر پیشنهاد و تولید نامه پاسخ به داوران.", icon: <FileEdit className="h-5 w-5" />, cta: "تولید پیشنهادهای بازنگری", engine: "revision" },
};

const DOC_TYPES = [
  { v: "proposal", l: "پروپوزال پژوهشی" },
  { v: "manuscript", l: "مقاله علمی" },
  { v: "protocol", l: "پروتکل مطالعه" },
  { v: "systematic_review", l: "مرور نظام‌مند / متاآنالیز" },
  { v: "case_report", l: "گزارش مورد" },
  { v: "thesis", l: "پایان‌نامه" },
  { v: "other", l: "سند پژوهشی دیگر" },
];

export function NewReviewView({ mode }: { mode: NewMode }) {
  const meta = MODE_META[mode];
  const [title, setTitle] = useState("");
  const [journal, setJournal] = useState("");
  const [articleType, setArticleType] = useState("");
  const [field, setField] = useState("");
  const [wordLimit, setWordLimit] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [docType, setDocType] = useState("unknown");
  const [classifying, setClassifying] = useState(false);
  const [classification, setClassification] = useState<any>(null);
  const [running, setRunning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 8));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const upload = async () => {
    if (files.length === 0) {
      toast.error("حداقل یک فایل انتخاب کنید.");
      return;
    }
    if (!title.trim()) {
      toast.error("عنوان سند را وارد کنید (مثلاً عنوان پروپوزال یا مقاله).");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      files.forEach((f) => fd.append("files", f));
      if (mode === "journal") {
        if (journal.trim()) fd.append("targetJournal", journal.trim());
        if (articleType.trim()) fd.append("articleType", articleType.trim());
        if (field.trim()) fd.append("researchField", field.trim());
        if (wordLimit.trim()) fd.append("wordLimit", wordLimit.trim());
      }
      const res = await api("/api/projects", { method: "POST", body: fd });
      setResult(res);
      setDocType(res.project?.docType || "unknown");
      toast.success("سند پردازش شد. نتایج استخراج را بررسی کنید.");
    } catch (e: any) {
      toast.error(e.message || "خطا در پردازش فایل");
    } finally {
      setUploading(false);
    }
  };

  const classify = async () => {
    if (!result) return;
    setClassifying(true);
    try {
      const res = await api(`/api/projects/${result.project.id}/classify`, { method: "POST" });
      setClassification(res.classification);
      setDocType(res.classification.docType);
      toast.success("نوع سند با هوش مصنوعی تشخیص داده شد.");
    } catch (e: any) {
      toast.error(e.message || "خطا در تشخیص نوع سند");
    } finally {
      setClassifying(false);
    }
  };

  const runEngine = async (engine: string) => {
    if (!result) return;
    // persist user-corrected type first
    try {
      await api(`/api/projects/${result.project.id}`, { method: "PATCH", body: JSON.stringify({ docType }) });
    } catch {
      /* non-fatal */
    }
    setRunning(engine);
    try {
      if (engine === "revision") {
        // revision assistant runs after a main review; guide the user
        toast.info("برای دستیار بازنگری، ابتدا داوری اصلی (پروپوزال/مقاله) اجرا شود؛ در صفحه پروژه از تب «دستیار بازنگری» استفاده کنید.");
        window.location.hash = `#/project/${result.project.id}`;
        return;
      }
      await api(`/api/projects/${result.project.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engine }),
      });
      toast.success("تحلیل کامل شد.");
      window.location.hash = `#/project/${result.project.id}`;
    } catch (e: any) {
      toast.error(e.message || "خطا در تحلیل");
      setRunning(null);
    }
  };

  return (
    <div className="fade-up space-y-5">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e6f5f3] text-[#0f766e]">{meta.icon}</div>
          <div>
            <h1 className="text-xl font-extrabold text-[#0e2a47]">{meta.title}</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">{meta.desc}</p>
          </div>
        </div>
      </div>

      {!result && (
        <div className="space-y-5 rounded-2xl border bg-white p-6">
          <div className="space-y-1.5">
            <Label htmlFor="title">عنوان سند</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: تأثیر آموزش خودمراقبتی بر کیفیت زندگی بیماران دیالتی" />
          </div>

          {mode === "journal" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>نام مجله هدف</Label>
                <Input value={journal} onChange={(e) => setJournal(e.target.value)} placeholder="مثلاً Journal of Nursing Scholarship" />
              </div>
              <div className="space-y-1.5">
                <Label>نوع مقاله</Label>
                <Input value={articleType} onChange={(e) => setArticleType(e.target.value)} placeholder="Original / Review / Case Report …" />
              </div>
              <div className="space-y-1.5">
                <Label>حوزه پژوهش</Label>
                <Input value={field} onChange={(e) => setField(e.target.value)} placeholder="پرستاری، اپیدمیولوژی، …" />
              </div>
              <div className="space-y-1.5">
                <Label>سقف واژه مجله (اختیاری)</Label>
                <Input type="number" value={wordLimit} onChange={(e) => setWordLimit(e.target.value)} placeholder="مثلاً 4000" />
              </div>
            </div>
          )}

          {/* Dropzone */}
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition",
              dragging ? "border-[#0f766e] bg-[#e6f5f3]/50" : "border-slate-200 bg-slate-50/50 hover:border-teal-300"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            role="button"
            aria-label="بارگذاری فایل"
            onClick={() => inputRef.current?.click()}
          >
            <UploadCloud className="h-10 w-10 text-[#0f766e]" />
            <div className="text-sm font-bold">فایل‌ها را اینجا رها کنید یا کلیک کنید</div>
            <div className="text-xs leading-5 text-muted-foreground">
              PDF (متنی)، DOCX، TXT، MD، RTF و فایل داده مکمل XLSX — حداکثر ۸ فایل، هر کدام تا ۳۰ مگابایت
              <br />
              فایل DOC قدیمی و تصاویر اسکن‌شده پشتیبانی نمی‌شوند و صریحاً اعلام خواهند شد.
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.docx,.doc,.txt,.md,.rtf,.xlsx,.xls"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="font-num text-xs text-muted-foreground">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                  <button
                    className="text-xs font-bold text-red-500 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles((prev) => prev.filter((_, j) => j !== i));
                    }}
                  >
                    حذف
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button className="h-11 w-full bg-[#0e2a47] text-base font-bold hover:bg-[#123c56]" onClick={upload} disabled={uploading}>
            {uploading ? "در حال پردازش اسناد…" : "بارگذاری و استخراج متن"}
          </Button>
        </div>
      )}

      {uploading && <LoadingPanel text="در حال استخراج متن از اسناد…" />}

      {result && (
        <div className="space-y-5">
          {/* Extraction results */}
          <div className="rounded-2xl border bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-[#0e2a47]">
              <ScanText className="h-5 w-5 text-[#0f766e]" />
              نتایج استخراج اسناد
            </h2>
            <div className="space-y-2">
              {result.documents.map((d: any, i: number) => {
                const st = DOC_STATUS_FA[d.status] || DOC_STATUS_FA.pending;
                return (
                  <div key={i} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{d.name}</span>
                      <StatusChip label={st.label} color={st.color} />
                      {d.pages != null && <span className="font-num text-xs text-muted-foreground">{d.pages} صفحه</span>}
                      {d.chars != null && <span className="font-num text-xs text-muted-foreground">{d.chars.toLocaleString("fa-IR")} نویسه</span>}
                    </div>
                    {d.notes && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs leading-5 text-amber-800">
                        <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {d.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Document type confirm */}
          <div className="rounded-2xl border bg-white p-6">
            <h2 className="mb-1 text-lg font-extrabold text-[#0e2a47]">تشخیص نوع سند</h2>
            <p className="mb-4 text-xs text-slate-500">
              تشخیص اولیه بر اساس واژگان سند انجام شده است. می‌توانید آن را اصلاح کنید و برای تشخیص دقیق‌تر (نوع + طرح مطالعه + راهنمای گزارش‌دهی پیشنهادی) از تحلیل هوشمند استفاده کنید.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 space-y-1.5">
                <Label>نوع سند</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => (
                      <SelectItem key={t.v} value={t.v}>
                        {t.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" className="h-10" onClick={classify} disabled={classifying}>
                <Sparkles className="h-4 w-4" />
                {classifying ? "در حال تحلیل…" : "تشخیص هوشمند نوع سند"}
              </Button>
            </div>
            {classification && (
              <div className="mt-4 space-y-2 rounded-xl bg-[#f5f7fa] p-4 text-sm leading-7">
                <div>
                  <b>طرح مطالعه شناسایی‌شده:</b> {classification.design || "نامشخص"}
                </div>
                <div>
                  <b>راهنمای گزارش‌دهی پیشنهادی:</b> {classification.suggestedGuideline || "—"}
                </div>
                <div className="text-xs text-slate-600">{classification.rationale}</div>
              </div>
            )}
          </div>

          {running && <LoadingPanel text="تحلیل هوش مصنوعی در جریان است — بسته به طول سند چند دقیقه طول می‌کشد…" />}

          {!running && (
            <Button className="h-12 w-full bg-[#0f766e] text-base font-bold hover:bg-[#0d655d]" onClick={() => runEngine(meta.engine)}>
              <CheckCircle2 className="h-5 w-5" />
              {meta.cta}
            </Button>
          )}

          <Banner tone="info">
            اسناد شما فقط در پایگاه‌داده محلی همین سامانه ذخیره می‌شود، برای آموزش مدل‌ها استفاده نمی‌شود و هر زمان از «تاریخچه» قابل حذف است.
          </Banner>
        </div>
      )}
    </div>
  );
}
