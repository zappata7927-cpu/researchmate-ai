"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  BookOpenCheck,
  Calculator,
  Check,
  Download,
  FileEdit,
  FileText,
  FlaskConical,
  Printer,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { Radar, RadarChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import {
  api,
  apiLong,
  CATEGORY_FA,
  DOC_STATUS_FA,
  DOC_TYPE_FA,
  RECOMMENDATION_FA,
  REF_STATUS_FA,
  SEVERITY_FA,
  faDate,
  faNum,
} from "@/lib/client";
import { Banner, EmptyState, LoadingPanel, ScoreRing, StatCard, WeightBar } from "./ui-bits";
import { IssuesList } from "./issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const GUIDELINE_STATUS_FA: Record<string, string> = {
  reported: "گزارش‌شده",
  partial: "ناقص",
  missing: "گزارش‌نشده",
  na: "غیرقابل ارزیابی",
};
const GUIDELINE_STATUS_COLOR: Record<string, string> = {
  reported: "#0f766e",
  partial: "#d97706",
  missing: "#dc2626",
  na: "#94a3b8",
};
const ROLE_FA: Record<string, string> = {
  expert: "داور ۱ — کارشناس موضوع",
  methodologist: "داور ۲ — متدولوژیست / اپیدمیولوژیست",
  biostatistician: "داور ۳ — بیواستاتیستین",
  editor: "داور ۴ — سردبیر آکادمیک",
};

export function ProjectView({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [journal, setJournal] = useState("");
  const [extraComments, setExtraComments] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await api(`/api/projects/${id}`);
      setData(d);
      setJournal(d.targetJournal || "");
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const reviews = useMemo(() => {
    const map: Record<string, any> = {};
    for (const r of data?.reviews || []) {
      // reviews arrive newest-first; keep the newest payload per engine
      if (!map[r.engine]) map[r.engine] = r.payload;
    }
    return map;
  }, [data]);

  const mainReview = reviews.proposal || reviews.manuscript || null;
  const mainEngine = reviews.proposal ? "proposal" : reviews.manuscript ? "manuscript" : null;
  const score = mainReview?.score || null;
  const issues: any[] = mainReview?.issues || [];

  if (error) return <Banner tone="danger" title="خطا در بارگذاری پروژه">{error}</Banner>;
  if (!data) return <LoadingPanel text="در حال بارگذاری پروژه…" />;

  const p = data;
  const docTypeLabel = DOC_TYPE_FA[p.docType] || p.docType;

  const runEngine = async (engine: string) => {
    setBusy(engine);
    try {
      // Reference verification runs in its own dedicated (async) route.
      const path = engine === "references" ? `/api/projects/${id}/references` : `/api/projects/${id}/review`;
      await apiLong(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(engine === "references" ? {} : { engine }),
      });
      toast.success("تحلیل کامل شد.");
      await load();
    } catch (e: any) {
      toast.error(e.message || "خطا در تحلیل");
    } finally {
      setBusy(null);
    }
  };

  const saveJournal = async () => {
    try {
      await api(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify({ targetJournal: journal }) });
      toast.success("مجله هدف ذخیره شد.");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const generateRevisions = async () => {
    setBusy("revision-gen");
    try {
      await apiLong(`/api/projects/${id}/revisions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate" }) });
      toast.success("پیشنهادهای بازنگری تولید شد.");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const updateRevision = async (revId: string, status: string, revisedText?: string) => {
    try {
      await api(`/api/projects/${id}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", revisionId: revId, status, revisedText }),
      });
      toast.success(status === "accepted" ? "بازنگری پذیرفته شد." : status === "rejected" ? "بازنگری رد شد." : "بازنگری به‌روزرسانی شد.");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const generateResponseLetter = async () => {
    setBusy("letter");
    try {
      const comments = extraComments.split("\n").filter((c) => c.trim());
      await apiLong(`/api/projects/${id}/response-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments }),
      });
      toast.success("نامه پاسخ به داوران تولید شد.");
      setExtraComments("");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const radarData = (score?.perCriterion || []).map((c: any) => ({
    subject: c.label.length > 18 ? c.label.slice(0, 17) + "…" : c.label,
    value: c.score === null ? 0 : c.score,
  }));

  const statusChip = () => {
    if (p.status === "ready") return { label: "تحلیل کامل", color: "#0f766e" };
    if (p.status === "error") return { label: "خطا در پردازش", color: "#dc2626" };
    if (p.status === "analyzing" || p.status === "extracting") return { label: "در حال پردازش", color: "#d97706" };
    return { label: "آماده تحلیل", color: "#0891b2" };
  };
  const chip = statusChip();

  return (
    <div className="fade-up space-y-5">
      {/* Header */}
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#0e2a47] px-3 py-1 text-[11px] font-bold text-white">{docTypeLabel}</span>
              <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: `${chip.color}15`, color: chip.color }}>{chip.label}</span>
              {p.reviewKind === "manuscript" && <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">حالت داوری مقاله</span>}
              {p.reviewKind === "proposal" && <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">حالت داوری پروپوزال</span>}
            </div>
            <h1 className="mt-3 text-xl font-extrabold leading-8 text-[#0e2a47]">{p.title}</h1>
            <div className="mt-1 text-xs text-muted-foreground">ایجاد: {faDate(p.createdAt)} — ویرایش: {faDate(p.updatedAt)}</div>
            {p.statusMessage && <div className="mt-2 text-xs font-medium text-amber-700">{p.statusMessage}</div>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => window.open(`/api/projects/${id}/print?report=full`, "_blank")}>
              <Printer className="h-4 w-4" /> گزارش HTML
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.open(`/api/projects/${id}/export?report=full`, "_blank")}>
              <Download className="h-4 w-4" /> گزارش جامع DOCX
            </Button>
          </div>
        </div>
      </div>

      {p.status === "error" && (
        <Banner tone="danger" title="پردازش با خطا متوقف شد">
          {p.statusMessage || "جزئیات بیشتر در تب اسناد بررسی کنید."}
        </Banner>
      )}

      {/* Main review dashboard */}
      {mainReview && (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border bg-white p-6">
              <ScoreRing value={score?.total ?? null} />
              {score && (
                <div className="text-center text-xs leading-5 text-muted-foreground">
                  معیارهای قابل ارزیابی: {faNum(score.assessable)} از {faNum(score.totalCriteria)}
                  {score.notAssessable > 0 && <> — غیرقابل ارزیابی: {faNum(score.notAssessable)}</>}
                </div>
              )}
              <div className="text-sm font-bold text-[#0f766e]">{RECOMMENDATION_FA[score?.recommendation] || score?.recommendation || ""}</div>
            </div>

            <div className="space-y-4 rounded-2xl border bg-white p-6 lg:col-span-2">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard title="بحرانی" value={faNum(score?.counts?.critical ?? 0)} tone="red" icon={<Target className="h-5 w-5" />} />
                <StatCard title="اساسی" value={faNum(score?.counts?.major ?? 0)} tone="amber" icon={<Target className="h-5 w-5" />} />
                <StatCard title="متوسط/جزئی" value={faNum(score?.counts?.moderate ?? 0 + (score?.counts?.minor ?? 0))} tone="slate" icon={<Target className="h-5 w-5" />} />
                {mainReview?.guideline && (
                  <StatCard title={`تبعیت از ${mainReview.guideline.name?.split(" ")[0] || "راهنما"}`} value={`${faNum(mainReview.guideline.complianceScore)}٪`} tone="teal" icon={<BookOpenCheck className="h-5 w-5" />} />
                )}
              </div>

              {score?.hasCriticalProblem && (
                <Banner tone="danger" title="هشدار: مشکل بحرانی شناسایی شد">
                  حداقل یک مشکل بحرانی در سند وجود دارد؛ این مشکل مستقل از امتیاز کل است و باید پیش از هر اقدام دیگری برطرف شود.
                </Banner>
              )}

              {mainReview.summary && (
                <div>
                  <h3 className="mb-1 text-sm font-extrabold text-[#0e2a47]">جمع‌بندی داوری</h3>
                  <p className="text-[13px] leading-7 text-slate-700">{mainReview.summary}</p>
                </div>
              )}
              {mainReview.recommendationExplanation && (
                <div className="rounded-xl bg-[#f5f7fa] p-3 text-xs leading-6 text-slate-600">
                  <b>منطق توصیه نهایی: </b>
                  {mainReview.recommendationExplanation}
                </div>
              )}
            </div>
          </div>

          {radarData.length > 0 && (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border bg-white p-5">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[#0e2a47]">
                  <BarChart3 className="h-4 w-4 text-[#0f766e]" /> نمای راداری معیارها (۰ تا ۵)
                </h3>
                <div className="h-72" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} outerRadius="75%">
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#475569" }} />
                      <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 9, fill: "#94a3b8" }} />
                      <Radar dataKey="value" stroke="#0f766e" fill="#0f766e" fillOpacity={0.28} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-2xl border bg-white p-5">
                <h3 className="mb-3 text-sm font-extrabold text-[#0e2a47]">امتیاز معیارها و وزن‌ها</h3>
                <div className="max-h-72 space-y-3 overflow-y-auto pl-1">
                  {score.perCriterion.map((c: any) => (
                    <WeightBar key={c.key} label={c.label} weight={c.weight} score={c.score} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {mainReview.strengths?.length > 0 && (
            <div className="rounded-2xl border bg-white p-5">
              <h3 className="mb-2 text-sm font-extrabold text-[#0e2a47]">نقاط قوت</h3>
              <ul className="list-inside list-disc space-y-1.5 text-[13px] leading-7 text-slate-700">
                {mainReview.strengths.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {issues.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-extrabold text-[#0e2a47]">
                ایرادها و اصلاح‌های پیشنهادی <span className="font-num text-sm font-bold text-slate-400">({faNum(issues.length)} مورد — مرتب بر اساس شدت)</span>
              </h3>
              <IssuesList issues={issues} />
            </div>
          )}

          {/* Guideline compliance */}
          {mainReview.guideline?.items?.length > 0 && (
            <div className="rounded-2xl border bg-white p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-[#0e2a47]">تبعیت از راهنمای گزارش‌دهی — {mainReview.guideline.name}</h3>
                <div className="rounded-full bg-[#e6f5f3] px-3 py-1 text-xs font-extrabold text-[#0f766e]">
                  نمره تبعیت: {faNum(mainReview.guideline.complianceScore)}٪
                </div>
              </div>
              <Banner tone="info">
                تبعیت از چک‌لیست گزارش‌دهی به معنای اعتبار روش‌شناختی نیست؛ این دو مستقل ارزیابی شده‌اند.
              </Banner>
              <Accordion type="single" collapsible className="mt-3">
                {mainReview.guideline.items.map((it: any, i: number) => (
                  <AccordionItem key={i} value={`g-${i}`}>
                    <AccordionTrigger className="text-right text-[13px]">
                      <span className="flex items-center gap-2">
                        <span className="rounded px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: GUIDELINE_STATUS_COLOR[it.status] }}>
                          {GUIDELINE_STATUS_FA[it.status] || it.status}
                        </span>
                        {it.item}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-xs leading-6 text-slate-600">
                      <div><b>محل:</b> {it.location || "—"}</div>
                      <div><b>توضیح:</b> {it.comment || "—"}</div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </div>
      )}

      {!mainReview && (
        <EmptyState
          title="داوری اصلی هنوز اجرا نشده است"
          hint={
            p.status === "error"
              ? "ابتدا مشکل استخراج سند را حل کنید (تب اسناد)."
              : p.reviewKind === "manuscript"
                ? "از تب «داوری مقاله» شروع کنید یا در ویزارد داوری مقاله، سند را بارگذاری و داوری را اجرا کنید."
                : "از تب «داوری پروپوزال» شروع کنید."
          }
          icon={<FileText className="h-8 w-8" />}
        />
      )}

      {/* Engine tabs */}
      <Tabs defaultValue={mainReview ? "issues" : "run-main"} className="rounded-2xl border bg-white p-5">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 overflow-x-auto bg-slate-50 p-1">
          <TabsTrigger value="run-main">اجرای داوری</TabsTrigger>
          <TabsTrigger value="stats">ممیزی آماری</TabsTrigger>
          <TabsTrigger value="references">منابع</TabsTrigger>
          <TabsTrigger value="journal">مجله هدف</TabsTrigger>
          <TabsTrigger value="reviewers">پنل داوران</TabsTrigger>
          <TabsTrigger value="revision">دستیار بازنگری</TabsTrigger>
          <TabsTrigger value="reports">گزارش‌ها و خروجی</TabsTrigger>
          <TabsTrigger value="docs">اسناد</TabsTrigger>
        </TabsList>

        {/* Run main */}
        <TabsContent value="run-main" className="pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button className="bg-[#0f766e] hover:bg-[#0d655d]" onClick={() => runEngine(p.reviewKind || "proposal")} disabled={busy !== null}>
              <Sparkles className="h-4 w-4" />
              {busy ? "در حال تحلیل…" : mainEngine ? "اجرای دوباره داوری اصلی" : p.reviewKind === "manuscript" ? "اجرای داوری کامل مقاله" : "اجرای داوری کامل پروپوزال"}
            </Button>
            <span className="text-xs leading-5 text-muted-foreground">
              داوری کامل با روبریک ۱۰۰ امتیازی + ایرادهای ۱۰ جزئی {p.reviewKind === "manuscript" ? "+ چک‌لیست راهنمای گزارش‌دهی متناسب با طرح مطالعه" : ""}
            </span>
          </div>
          {busy && <div className="mt-4"><LoadingPanel text="تحلیل هوش مصنوعی در جریان است…" /></div>}
        </TabsContent>

        {/* Stats */}
        <TabsContent value="stats" className="pt-4">
          <StatsTab audit={reviews.stats} busy={busy} onRun={() => runEngine("stats")} />
        </TabsContent>

        {/* References */}
        <TabsContent value="references" className="pt-4">
          <ReferencesTab refs={reviews.references} busy={busy} onRun={() => runEngine("references")} />
        </TabsContent>

        {/* Journal */}
        <TabsContent value="journal" className="pt-4">
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <div className="min-w-64 flex-1 space-y-1.5">
              <Label>مجله هدف</Label>
              <Input value={journal} onChange={(e) => setJournal(e.target.value)} placeholder="نام مجله مقصد" />
            </div>
            <Button variant="outline" onClick={saveJournal}>ذخیره</Button>
            <Button className="bg-[#0f766e] hover:bg-[#0d655d]" onClick={() => runEngine("journal")} disabled={busy !== null || !journal.trim()}>
              <Send className="h-4 w-4" />
              {busy === "journal" ? "در حال ارزیابی…" : "ارزیابی آمادگی انتشار"}
            </Button>
          </div>
          <JournalTab review={reviews.journal} />
        </TabsContent>

        {/* Reviewers */}
        <TabsContent value="reviewers" className="pt-4">
          <div className="mb-4 flex items-center gap-3">
            <Button className="bg-[#0f766e] hover:bg-[#0d655d]" onClick={() => runEngine("reviewers")} disabled={busy !== null}>
              <FlaskConical className="h-4 w-4" />
              {busy === "reviewers" ? "جلسه داوری در جریان…" : "اجرای پنل داوری شبیه‌سازی‌شده"}
            </Button>
            <span className="text-xs text-muted-foreground">چهار داور مستقل + سنتز سردبیری</span>
          </div>
          {busy === "reviewers" && <LoadingPanel text="چهار داور در حال بررسی مستقل سند هستند…" />}
          <ReviewersTab sim={reviews.reviewers} />
        </TabsContent>

        {/* Revision assistant */}
        <TabsContent value="revision" className="pt-4">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Button className="bg-[#0f766e] hover:bg-[#0d655d]" onClick={generateRevisions} disabled={busy !== null || !mainReview}>
              <FileEdit className="h-4 w-4" />
              {busy === "revision-gen" ? "تولید پیشنهادها…" : "تولید پیشنهادهای بازنگری از ایرادهای مهم"}
            </Button>
            {!mainReview && <span className="text-xs text-amber-700">ابتدا داوری اصلی را اجرا کنید.</span>}
          </div>
          {busy === "revision-gen" && <LoadingPanel text="تولید بازنویسی‌های پیشنهادی…" />}
          <RevisionsList revisions={data.revisions} onUpdate={updateRevision} />
        </TabsContent>

        {/* Reports */}
        <TabsContent value="reports" className="pt-4">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button className="bg-[#0e2a47] hover:bg-[#123c56]" onClick={() => runEngine("reports")} disabled={busy !== null || !mainReview}>
                <FileText className="h-4 w-4" />
                {busy === "reports" ? "تولید گزارش‌ها…" : "تولید گزارش A (نویسندگان) و گزارش B (سردبیر)"}
              </Button>
              {!mainReview && <span className="text-xs text-amber-700">برای تولید گزارش رسمی، ابتدا داوری اصلی را اجرا کنید.</span>}
            </div>
            {busy === "reports" && <LoadingPanel text="تولید دو گزارش رسمی…" />}

            {reviews.reports && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border p-5">
                  <h4 className="mb-2 font-extrabold text-[#0e2a47]">گزارش A — نظرات برای نویسندگان</h4>
                  <p className="mb-3 line-clamp-4 text-xs leading-6 text-slate-600">{reviews.reports.reportA?.generalAssessment}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => window.open(`/api/projects/${id}/print?report=authors`, "_blank")}>
                      <Printer className="h-3.5 w-3.5" /> HTML / PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.open(`/api/projects/${id}/export?report=authors`, "_blank")}>
                      <Download className="h-3.5 w-3.5" /> DOCX
                    </Button>
                  </div>
                </div>
                <div className="rounded-2xl border border-red-200 p-5">
                  <h4 className="mb-2 font-extrabold text-red-700">گزارش B — محرمانه برای سردبیر</h4>
                  <p className="mb-3 line-clamp-4 text-xs leading-6 text-slate-600">{reviews.reports.reportB?.scientificMerit}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => window.open(`/api/projects/${id}/print?report=editor`, "_blank")}>
                      <Printer className="h-3.5 w-3.5" /> HTML / PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.open(`/api/projects/${id}/export?report=editor`, "_blank")}>
                      <Download className="h-3.5 w-3.5" /> DOCX
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Response letter */}
            <div className="rounded-2xl border bg-white p-5">
              <h4 className="mb-2 font-extrabold text-[#0e2a47]">نامه پاسخ به داوران (Response to Reviewers)</h4>
              <p className="mb-3 text-xs leading-6 text-slate-600">
                نامه point-by-point بر اساس ایرادهای داوری و بازنگری‌های «پذیرفته‌شده» شما ساخته می‌شود. اگر اصلاحی انجام نشده باشد، سامانه ادعای اصلاح انجام‌شده نمی‌کند.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-64 flex-1 space-y-1.5">
                  <Label>نظرات اضافی داوران (هر سطر یک نظر — اختیاری)</Label>
                  <Textarea rows={3} value={extraComments} onChange={(e) => setExtraComments(e.target.value)} placeholder="نظرات داوران بیرونی را برای پاسخ‌دهی اضافه کنید" />
                </div>
                <Button className="bg-[#0f766e] hover:bg-[#0d655d]" onClick={generateResponseLetter} disabled={busy !== null}>
                  {busy === "letter" ? "تولید نامه…" : "تولید نامه پاسخ"}
                </Button>
              </div>
              {reviews.response_letter && (
                <div className="mt-4 space-y-3">
                  <Banner tone={reviews.response_letter.meta?.appliedRevisions === 0 ? "warn" : "success"}>
                    {reviews.response_letter.meta?.honestyNote}
                  </Banner>
                  <Accordion type="single" collapsible>
                    {reviews.response_letter.responses?.map((r: any, i: number) => (
                      <AccordionItem key={i} value={`rl-${i}`}>
                        <AccordionTrigger className="text-right text-[13px]">
                          نظر {faNum(i + 1)}: {r.comment?.slice(0, 70)}…
                        </AccordionTrigger>
                        <AccordionContent className="space-y-2 text-xs leading-6 text-slate-700">
                          <div><b>پاسخ:</b> {r.response}</div>
                          {r.changesMade && <div><b>تغییرات:</b> {r.changesMade}</div>}
                          <div className="text-slate-500"><b>محل:</b> {r.location || "(صفحه/سطر پس از نهایی‌سازی تعیین شود)"}</div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                  <Button size="sm" variant="outline" onClick={() => window.open(`/api/projects/${id}/export?report=response_letter`, "_blank")}>
                    <Download className="h-3.5 w-3.5" /> دانلود نامه (DOCX)
                  </Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="docs" className="pt-4">
          <div className="space-y-2">
            {data.documents.map((d: any) => {
              const st = DOC_STATUS_FA[d.status] || DOC_STATUS_FA.pending;
              return (
                <div key={d.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="font-bold">{d.name}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold">{d.kind === "main" ? "سند اصلی" : "داده مکمل"}</span>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${st.color}15`, color: st.color }}>{st.label}</span>
                    {d.pages != null && <span className="font-num text-xs text-muted-foreground">{faNum(d.pages)} صفحه</span>}
                    <span className="font-num text-xs text-muted-foreground">{faNum((d.size / 1024).toFixed(0))} کیلوبایت</span>
                  </div>
                  {d.notes && <div className="mt-2 rounded-lg bg-amber-50 p-2 text-xs leading-5 text-amber-800">{d.notes}</div>}
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
function RunEmpty({ onRun, busy, icon, text }: { onRun: () => void; busy: boolean; icon: React.ReactNode; text: string }) {
  return (
    <EmptyState
      title="این تحلیل هنوز اجرا نشده است"
      hint={text}
      icon={icon}
    />
  );
}

function StatsTab({ audit, busy, onRun }: { audit: any; busy: string | null; onRun: () => void }) {
  return (
    <div className="pt-1">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button className="bg-[#0f766e] hover:bg-[#0d655d]" onClick={onRun} disabled={busy !== null}>
          <Calculator className="h-4 w-4" />
          {busy === "stats" ? "ممیزی در جریان…" : audit ? "اجرای دوباره ممیزی آماری" : "اجرای ممیزی آماری"}
        </Button>
      </div>
      {busy === "stats" && <LoadingPanel text="ممیزی آماری در جریان است…" />}
      {!audit && !busy && (
        <RunEmpty
          onRun={onRun}
          busy={!!busy}
          icon={<Calculator className="h-8 w-8" />}
          text="بررسی تناسب آزمون‌ها، فرض‌های آماری، حجم نمونه و توان، مخدوش‌گری، داده گمشده و سازگاری جداول با متن."
        />
      )}
      {audit && (
        <div className="space-y-4">
          {audit.summary && <p className="text-[13px] leading-7 text-slate-700">{audit.summary}</p>}
          {audit.score && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard title="امتیاز ممیزی آماری" value={audit.score.total == null ? "—" : faNum(audit.score.total)} tone="teal" icon={<BarChart3 className="h-5 w-5" />} />
              <StatCard title="بحرانی" value={faNum(audit.score.counts?.critical ?? 0)} tone="red" icon={<Target className="h-5 w-5" />} />
              <StatCard title="اساسی" value={faNum(audit.score.counts?.major ?? 0)} tone="amber" icon={<Target className="h-5 w-5" />} />
              <StatCard title="توصیه" value={RECOMMENDATION_FA[audit.score.recommendation] || "—"} tone="navy" icon={<Check className="h-5 w-5" />} />
            </div>
          )}
          {audit.criteria?.length > 0 && (
            <div className="rounded-2xl border bg-white p-5">
              <h4 className="mb-3 text-sm font-extrabold text-[#0e2a47]">معیارهای ممیزی</h4>
              <div className="space-y-3">
                {audit.criteria.map((c: any) => (
                  <WeightBar key={c.key} label={c.label || c.key} weight={5} score={c.score} note={c.justification} />
                ))}
              </div>
            </div>
          )}
          {audit.findings?.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-extrabold text-[#0e2a47]">یافته‌های دقیق ممیزی</h4>
              {audit.findings.map((f: any, i: number) => (
                <div key={i} className="rounded-2xl border bg-white p-4" style={{ borderRight: "4px solid #ea580c" }}>
                  <div className="text-sm font-bold text-[#0e2a47]">{faNum(i + 1)}. {f.problem}</div>
                  <div className="mt-2 space-y-1 text-xs leading-6 text-slate-600">
                    <div><b>محل:</b> {f.location || "—"}</div>
                    {f.excerpt && <div><b>نقل‌قول:</b> <i>{f.excerpt}</i></div>}
                    <div><b>اهمیت:</b> {f.whyItMatters}</div>
                    <div><b>اصلاح:</b> {f.correction}</div>
                    {f.alternativeMethod && <div><b>روش جایگزین:</b> {f.alternativeMethod}</div>}
                    {f.correctedReportingExample && (
                      <div className="rounded-lg bg-[#e6f5f3]/60 p-2 leading-7"><b>نمونه گزارش اصلاح‌شده:</b> {f.correctedReportingExample}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {audit.issues?.length > 0 && <IssuesList issues={audit.issues} />}
          {audit.needsRawData?.length > 0 && (
            <Banner tone="warn" title="موارد نیازمند داده خام">
              این موارد فقط با دسترسی به داده اولیه قابل قضاوت قطعی هستند: {audit.needsRawData.join("؛ ")}
            </Banner>
          )}
        </div>
      )}
    </div>
  );
}

function ReferencesTab({ refs, busy, onRun }: { refs: any; busy: string | null; onRun: () => void }) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button className="bg-[#0f766e] hover:bg-[#0d655d]" onClick={onRun} disabled={busy !== null}>
          <BookOpenCheck className="h-4 w-4" />
          {busy === "references" ? "راستی‌آزمایی در جریان…" : refs ? "اجرای دوباره بررسی منابع" : "اجرای بررسی منابع"}
        </Button>
        <span className="text-xs text-muted-foreground">Crossref · OpenAlex · PubMed — حداکثر ۲۵ منبع در هر اجرا</span>
      </div>
      {busy === "references" && <LoadingPanel text="استخراج منابع و جست‌وجو در پایگاه‌های علمی…" />}
      {!refs && !busy && (
        <RunEmpty onRun={onRun} busy={!!busy} icon={<BookOpenCheck className="h-8 w-8" />} text="هر منبع در پایگاه‌های واقعی علمی جست‌وجو می‌شود؛ «یافت‌نشدن» به معنای وجود نداشتن سند نیست." />
      )}
      {refs && (
        <div className="space-y-4">
          {refs.summary && <p className="text-[13px] leading-7 text-slate-700">{refs.summary}</p>}
          {refs.issues?.length > 0 && <IssuesList issues={refs.issues} />}
          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[720px] text-right text-xs">
              <thead className="bg-[#0e2a47] text-white">
                <tr>
                  <th className="p-2.5 font-bold">#</th>
                  <th className="p-2.5 font-bold">استناد</th>
                  <th className="p-2.5 font-bold">وضعیت</th>
                  <th className="p-2.5 font-bold">یادداشت راستی‌آزمایی</th>
                </tr>
              </thead>
              <tbody>
                {refs.references?.map((r: any, i: number) => {
                  const st = REF_STATUS_FA[r.check?.status] || REF_STATUS_FA.unverified;
                  return (
                    <tr key={i} className={cn("border-t", i % 2 === 1 && "bg-slate-50/60")}>
                      <td className="p-2.5 font-num font-bold">{faNum(i + 1)}</td>
                      <td className="max-w-[340px] p-2.5 leading-5" dir="ltr" style={{ textAlign: "left" }}>
                        <span className="line-clamp-3">{r.raw}</span>
                      </td>
                      <td className="p-2.5">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${st.color}15`, color: st.color }}>
                          {st.label}{r.check?.retracted ? " ⚠" : ""}
                        </span>
                      </td>
                      <td className="p-2.5 leading-5 text-slate-600">{r.check?.note || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Banner tone="info">
            یافته‌های فوق بر اساس متادیتای عمومی پایگاه‌ها است. «راستی‌آزمایی نشد» به معنای ساختگی بودن منبع نیست؛ بررسی دستی توصیه می‌شود.
          </Banner>
        </div>
      )}
    </div>
  );
}

function JournalTab({ review }: { review: any }) {
  if (!review) return <EmptyState title="ارزیابی آمادگی انتشار اجرا نشده است" hint="مجله هدف را وارد و ارزیابی را اجرا کنید." icon={<Send className="h-8 w-8" />} />;
  const recColor =
    review.recommendation === "ready" ? "#0f766e" : review.recommendation === "minor_revision" ? "#0891b2" : review.recommendation === "major_revision" ? "#d97706" : review.recommendation === "high_rejection_risk" ? "#dc2626" : "#64748b";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-2xl border p-4 text-center">
          <div className="text-3xl font-extrabold font-num" style={{ color: recColor }}>{faNum(review.readinessScore)}</div>
          <div className="text-[11px] text-muted-foreground">امتیاز آمادگی از ۱۰۰</div>
        </div>
        <div className="rounded-full px-4 py-2 text-sm font-extrabold" style={{ background: `${recColor}15`, color: recColor }}>
          {RECOMMENDATION_FA[review.recommendation] || review.recommendation}
        </div>
      </div>
      {review.summary && <p className="text-[13px] leading-7 text-slate-700">{review.summary}</p>}
      {review.scopeFit && <div className="rounded-xl bg-[#f5f7fa] p-3 text-xs leading-6"><b>تناسب با محدوده مجله:</b> {review.scopeFit}</div>}
      {review.recommendationExplanation && <div className="rounded-xl bg-[#f5f7fa] p-3 text-xs leading-6"><b>منطق توصیه:</b> {review.recommendationExplanation}</div>}
      {review.uncertaintyNote && (
        <Banner tone="warn" title="شفافیت درباره محدودیت‌ها">{review.uncertaintyNote}</Banner>
      )}
      {review.missingDeclarations?.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">
          <b>اعلامیه‌های جاافتاده:</b> {review.missingDeclarations.join("؛ ")}
        </div>
      )}
      {review.formattingIssues?.length > 0 && <IssuesList issues={review.formattingIssues} />}
    </div>
  );
}

function ReviewersTab({ sim }: { sim: any }) {
  if (!sim) return <EmptyState title="پنل داوری شبیه‌سازی‌شده اجرا نشده است" hint="چهار داور مستقل سند را از دیدگاه‌های متفاوت ارزیابی می‌کنند." icon={<FlaskConical className="h-8 w-8" />} />;
  return (
    <div className="space-y-4">
      {sim.reviewers?.map((r: any, i: number) => (
        <div key={i} className="rounded-2xl border bg-white p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-extrabold text-[#0e2a47]">{ROLE_FA[r.role] || r.role}</h4>
            <span className="rounded-full bg-[#e6f5f3] px-3 py-1 text-[11px] font-extrabold text-[#0f766e]">
              توصیه: {RECOMMENDATION_FA[r.recommendation] || r.recommendation}
            </span>
          </div>
          {r.justification && <p className="mb-3 text-xs leading-6 text-slate-600">{r.justification}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            {r.strengths?.length > 0 && (
              <div>
                <b className="text-xs text-teal-700">نقاط قوت</b>
                <ul className="mt-1 list-inside list-disc space-y-1 text-xs leading-6 text-slate-700">{r.strengths.map((s: string, j: number) => <li key={j}>{s}</li>)}</ul>
              </div>
            )}
            {r.majorWeaknesses?.length > 0 && (
              <div>
                <b className="text-xs text-orange-600">ضعف‌های اساسی</b>
                <ul className="mt-1 list-inside list-disc space-y-1 text-xs leading-6 text-slate-700">{r.majorWeaknesses.map((s: string, j: number) => <li key={j}>{s}</li>)}</ul>
              </div>
            )}
            {r.minorWeaknesses?.length > 0 && (
              <div>
                <b className="text-xs text-slate-500">ضعف‌های جزئی</b>
                <ul className="mt-1 list-inside list-disc space-y-1 text-xs leading-6 text-slate-700">{r.minorWeaknesses.map((s: string, j: number) => <li key={j}>{s}</li>)}</ul>
              </div>
            )}
            {r.questionsToAuthors?.length > 0 && (
              <div>
                <b className="text-xs text-[#0e2a47]">پرسش از نویسندگان</b>
                <ul className="mt-1 list-inside list-disc space-y-1 text-xs leading-6 text-slate-700">{r.questionsToAuthors.map((s: string, j: number) => <li key={j}>{s}</li>)}</ul>
              </div>
            )}
          </div>
        </div>
      ))}
      {sim.synthesis && (
        <div className="rounded-2xl border-2 border-[#0e2a47] bg-[#f5f7fa] p-5">
          <h4 className="mb-2 font-extrabold text-[#0e2a47]">سنتز سردبیری — تصمیم نهایی: {RECOMMENDATION_FA[sim.synthesis.finalRecommendation] || sim.synthesis.finalRecommendation}</h4>
          {sim.synthesis.explanation && <p className="text-xs leading-6 text-slate-700">{sim.synthesis.explanation}</p>}
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            {sim.synthesis.agreements?.length > 0 && (
              <div>
                <b className="text-xs text-teal-700">توافق‌ها</b>
                <ul className="mt-1 list-inside list-disc text-xs leading-6 text-slate-700">{sim.synthesis.agreements.map((s: string, j: number) => <li key={j}>{s}</li>)}</ul>
              </div>
            )}
            {sim.synthesis.disagreements?.length > 0 && (
              <div>
                <b className="text-xs text-amber-600">اختلاف‌نظرها</b>
                <ul className="mt-1 list-inside list-disc text-xs leading-6 text-slate-700">
                  {sim.synthesis.disagreements.map((d: any, j: number) => (
                    <li key={j}>{d.topic} — {d.resolution}</li>
                  ))}
                </ul>
              </div>
            )}
            {sim.synthesis.priorities?.length > 0 && (
              <div>
                <b className="text-xs text-red-600">اولویت‌های اصلاح</b>
                <ul className="mt-1 list-inside list-disc text-xs leading-6 text-slate-700">{sim.synthesis.priorities.map((s: string, j: number) => <li key={j}>{s}</li>)}</ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RevisionsList({ revisions, onUpdate }: { revisions: any[]; onUpdate: (id: string, status: string, text?: string) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  if (!revisions?.length) {
    return <EmptyState title="هنوز بازنگری‌ای ساخته نشده است" hint="پس از داوری اصلی، پیشنهادهای بازنویسی برای ایرادهای مهم تولید می‌شود. هر پیشنهاد را می‌توانید بپذیرید، رد کنید یا ویرایش کنید." icon={<FileEdit className="h-8 w-8" />} />;
  }
  return (
    <div className="space-y-3">
      {revisions.map((r) => (
        <div key={r.id} className="rounded-2xl border bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 text-sm font-bold text-[#0e2a47]">{r.issueTitle || "بازنگری پیشنهادی"}</div>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-bold",
                r.status === "accepted" ? "bg-teal-50 text-teal-700" : r.status === "rejected" ? "bg-red-50 text-red-600" : r.status === "edited" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600"
              )}
            >
              {r.status === "accepted" ? "پذیرفته‌شده" : r.status === "rejected" ? "ردشده" : r.status === "edited" ? "ویرایش‌شده" : "پیشنهاد"}
            </span>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="mb-1 text-[11px] font-bold text-slate-500">متن اصلی</div>
              <div className="max-h-40 overflow-y-auto text-xs leading-6 text-slate-700">{r.originalText || "—"}</div>
            </div>
            {editing === r.id ? (
              <div className="rounded-xl border border-teal-300 p-3">
                <div className="mb-1 text-[11px] font-bold text-teal-700">ویرایش متن پیشنهادی</div>
                <Textarea rows={5} value={editText} onChange={(e) => setEditText(e.target.value)} />
              </div>
            ) : (
              <div className="rounded-xl bg-[#e6f5f3]/50 p-3">
                <div className="mb-1 text-[11px] font-bold text-teal-700">نسخه بازنویسی‌شده پیشنهادی</div>
                <div className="max-h-40 overflow-y-auto text-xs leading-6 text-slate-700">{r.revisedText || "—"}</div>
              </div>
            )}
          </div>
          {r.rationale && <div className="mt-2 rounded-lg bg-[#f5f7fa] p-2.5 text-[11px] leading-5 text-slate-600">{r.rationale}</div>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => onUpdate(r.id, "accepted")} disabled={r.status === "accepted"}>
              <ThumbsUp className="h-3.5 w-3.5" /> پذیرش
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onUpdate(r.id, "rejected")} disabled={r.status === "rejected"}>
              <ThumbsDown className="h-3.5 w-3.5" /> رد
            </Button>
            {editing === r.id ? (
              <Button size="sm" variant="outline" onClick={() => { onUpdate(r.id, "edited", editText); setEditing(null); }}>
                <Check className="h-3.5 w-3.5" /> ذخیره ویرایش
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => { setEditing(r.id); setEditText(r.revisedText); }}>
                <RefreshCw className="h-3.5 w-3.5" /> ویرایش پیشنهاد
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
