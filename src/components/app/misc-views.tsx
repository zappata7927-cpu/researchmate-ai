"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BookOpenCheck,
  FileText,
  Globe,
  History as HistoryIcon,
  Lock,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { api, DOC_TYPE_FA, RECOMMENDATION_FA, faDate, faNum } from "@/lib/client";
import { Banner, EmptyState, LoadingPanel } from "./ui-bits";
import { HashLink } from "./shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GUIDELINES_CLIENT } from "./guidelines-data";

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
export function HistoryView() {
  const [projects, setProjects] = useState<any[] | null>(null);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [renaming, setRenaming] = useState<any>(null);
  const [newTitle, setNewTitle] = useState("");

  const refresh = useCallback(async (query: string) => {
    try {
      const res = await api(`/api/projects${query ? `?q=${encodeURIComponent(query)}` : ""}`);
      setProjects(res.projects);
    } catch {
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    api(`/api/projects${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then((res) => {
        if (alive) setProjects(res.projects);
      })
      .catch(() => {
        if (alive) setProjects([]);
      });
    return () => {
      alive = false;
    };
  }, [q]);

  const rename = async () => {
    if (!renaming) return;
    try {
      await api(`/api/projects/${renaming.id}`, { method: "PATCH", body: JSON.stringify({ title: newTitle }) });
      toast.success("نام پروژه تغییر کرد.");
      setRenaming(null);
      refresh(q);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const remove = async (p: any) => {
    if (!window.confirm(`پروژه «${p.title}» و همه گزارش‌های آن حذف شود؟ این عمل قابل بازگشت نیست.`)) return;
    try {
      await api(`/api/projects/${p.id}`, { method: "DELETE" });
      toast.success("پروژه حذف شد.");
      refresh(q);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const filtered = (projects || []).filter((p) => typeFilter === "all" || p.docType === typeFilter);

  return (
    <div className="fade-up space-y-4">
      <div className="rounded-2xl border bg-white p-6">
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-[#0e2a47]">
          <HistoryIcon className="h-5 w-5 text-[#0f766e]" />
          تاریخچه داوری‌ها و گزارش‌ها
        </h1>
        <p className="mt-1 text-sm text-slate-600">همه پروژه‌های شما با نسخه‌های تحلیل، گزارش‌ها و فایل‌های خروجی.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="relative min-w-64 flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pr-9" placeholder="جست‌وجو در عنوان پروژه‌ها…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="همه انواع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه انواع سند</SelectItem>
              {Object.entries(DOC_TYPE_FA).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!projects && <LoadingPanel text="در حال بارگذاری…" />}
      {projects && filtered.length === 0 && (
        <EmptyState title="پروژه‌ای یافت نشد" hint="با دکمه «داوری پروپوزال» یا «داوری مقاله» شروع کنید." icon={<FileText className="h-8 w-8" />} />
      )}
      <div className="space-y-2">
        {filtered.map((p) => (
          <div key={p.id} className="card-hover rounded-2xl border bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <HashLink href={`#/project/${p.id}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f5f7fa] text-sm font-extrabold font-num text-[#0e2a47]">
                {p.totalScore == null ? "—" : faNum(Math.round(p.totalScore))}
              </HashLink>
              <div className="min-w-0 flex-1">
                <HashLink href={`#/project/${p.id}`} className="block truncate text-sm font-bold text-[#0e2a47] hover:underline">
                  {p.title}
                </HashLink>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {DOC_TYPE_FA[p.docType] || p.docType} · {faDate(p.createdAt)}
                  {typeof p.totalScore === "number" && <> · امتیاز {faNum(p.totalScore)}</>}
                  {p.recommendation && <> · {RECOMMENDATION_FA[p.recommendation] || p.recommendation}</>}
                  {p.criticalCount > 0 && <span className="mr-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">{faNum(p.criticalCount)} بحرانی</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" onClick={() => window.open(`/api/projects/${p.id}/print?report=full`, "_blank")}>
                  گزارش
                </Button>
                <Dialog open={renaming?.id === p.id} onOpenChange={(v) => !v && setRenaming(null)}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" onClick={() => { setRenaming(p); setNewTitle(p.title); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>تغییر نام پروژه</DialogTitle>
                    </DialogHeader>
                    <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                    <Button className="bg-[#0f766e] hover:bg-[#0d655d]" onClick={rename}>ذخیره</Button>
                  </DialogContent>
                </Dialog>
                <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => remove(p)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
interface RubricRow {
  key: string;
  label: string;
  weight: number;
}

export function SettingsView() {
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const s = await api("/api/settings");
    setSettings(s);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!settings) return <LoadingPanel text="در حال بارگذاری تنظیمات…" />;

  const sumOf = (list: RubricRow[]) => list.reduce((s, r) => s + (Number(r.weight) || 0), 0);

  const setWeight = (which: "proposalWeights" | "manuscriptWeights", key: string, value: number) => {
    setSettings((prev: any) => ({
      ...prev,
      [which]: prev[which].map((r: RubricRow) => (r.key === key ? { ...r, weight: value } : r)),
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proposalWeights: settings.proposalWeights, manuscriptWeights: settings.manuscriptWeights }) });
      toast.success("وزن‌ها ذخیره شد. داوری‌های بعدی با وزن‌های جدید انجام می‌شود.");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const RubricEditor = ({ which, title }: { which: "proposalWeights" | "manuscriptWeights"; title: string }) => {
    const rows: RubricRow[] = settings[which];
    const sum = sumOf(rows);
    return (
      <div className="rounded-2xl border bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-extrabold text-[#0e2a47]">{title}</h3>
          <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${sum === 100 ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"}`}>
            جمع وزن‌ها: {faNum(sum)} {sum === 100 ? "(استاندارد)" : "(دلخواه — نیازی به ۱۰۰ نیست)"}
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-2 rounded-xl border p-2.5">
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">{r.label}</span>
              <Input
                type="number"
                min={0}
                max={100}
                className="h-8 w-20 text-center font-num"
                value={r.weight}
                onChange={(e) => setWeight(which, r.key, Number(e.target.value))}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fade-up space-y-4">
      <div className="rounded-2xl border bg-white p-6">
        <h1 className="text-xl font-extrabold text-[#0e2a47]">تنظیمات و استانداردهای داوری</h1>
        <p className="mt-1 text-sm text-slate-600">
          وزن‌های روبریک ۱۰۰ امتیازی را مطابق الزامات نهاد مالی یا دانشگاه خود تنظیم کنید. امتیازدهی هر معیار ۰ تا ۵ است و وزن‌ها آن را به ۱۰۰ تبدیل می‌کنند.
        </p>
      </div>

      {/* AI status */}
      <div className="rounded-2xl border bg-white p-5">
        <h3 className="mb-2 flex items-center gap-2 font-extrabold text-[#0e2a47]">
          <Globe className="h-4 w-4 text-[#0f766e]" /> وضعیت موتور هوش مصنوعی
        </h3>
        {settings.ai?.configured ? (
          <Banner tone="success">
            موتور تحلیل فعال است — سرویس: <b>{settings.ai.provider}</b> · مدل: <b>{settings.ai.model}</b>
          </Banner>
        ) : (
          <Banner tone="warn" title="موتور تحلیل غیرفعال است">
            برای فعال‌سازی، در فایل <code>.env</code> سه مقدار تنظیم کنید:
            <div dir="ltr" className="mt-2 rounded bg-slate-900 p-3 text-left text-[11px] leading-6 text-teal-200">
              AI_BASE_URL=https://api.openai.com/v1 &nbsp;(یا هر سرویس سازگار OpenAI مثل https://api.z.ai/api/paas/v4)
              <br />
              AI_API_KEY=کلید_شما
              <br />
              AI_MODEL=glm-4.6 &nbsp;(یا gpt-4o و…)
            </div>
            سپس برنامه را مجدداً راه‌اندازی کنید.
          </Banner>
        )}
      </div>

      <RubricEditor which="proposalWeights" title="وزن‌های روبریک داوری پروپوزال" />
      <RubricEditor which="manuscriptWeights" title="وزن‌های روبریک داوری مقاله" />

      <Button className="h-11 w-full bg-[#0e2a47] text-base font-bold hover:bg-[#123c56]" onClick={save} disabled={saving}>
        {saving ? "در حال ذخیره…" : "ذخیره وزن‌ها"}
      </Button>

      {/* Privacy */}
      <div className="rounded-2xl border bg-white p-5">
        <h3 className="mb-2 flex items-center gap-2 font-extrabold text-[#0e2a47]">
          <Lock className="h-4 w-4 text-[#0f766e]" /> اخلاق، حریم خصوصی و اعتمادپذیری AI
        </h3>
        <ul className="list-inside list-disc space-y-1.5 text-xs leading-6 text-slate-600">
          <li>اسناد و تحلیل‌ها فقط در پایگاه‌داده محلی همین نصب ذخیره می‌شوند و برای آموزش مدل‌ها استفاده نمی‌شوند.</li>
          <li>پردازش هوش مصنوعی سمت سرور انجام می‌شود؛ کلید API هرگز در مرورگر قرار نمی‌گیرد.</li>
          <li>هیچ منبع، DOI، نتیجه یا نقل‌قولی ساخته نمی‌شود؛ «یافت‌نشدن» از «وجود نداشتن» متمایز است.</li>
          <li>اطلاعات ناقص به‌عنوان «غیرقابل ارزیابی» علامت‌گذاری می‌شود، نه صفر.</li>
          <li>مشکلات بحرانی اخلاقی/روش‌شناختی مستقل از امتیاز کل نمایش داده می‌شوند.</li>
          <li>خروجی سامانه جایگزین داوری انسانی مجاز یا تصمیم هیئت تحریریه نیست (ICMJE/COPE).</li>
          <li>می‌توانید هر پروژه را کامل و بدون بازگشت از «تاریخچه» حذف کنید.</li>
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// About
// ---------------------------------------------------------------------------
export function AboutView() {
  return (
    <div className="fade-up space-y-4">
      <div className="navy-gradient rounded-3xl p-8 text-center text-white">
        <h1 className="text-3xl font-extrabold">پژوهش‌یار هوشمند</h1>
        <div className="mt-1 text-sm font-medium tracking-wide text-teal-300">ResearchMate AI</div>
        <p className="mx-auto mt-4 max-w-2xl leading-8 text-slate-200">
          سامانه هوشمند ارزیابی، داوری و ارتقای کیفیت پژوهش — برای پروپوزال‌ها، مقالات علمی، پروتکل‌ها، مرورهای نظام‌مند و
          سایر اسناد پژوهشی. از ارسال پژوهش تا تعالی علمی.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6">
          <h3 className="mb-3 flex items-center gap-2 font-extrabold text-[#0e2a47]">
            <ShieldCheck className="h-5 w-5 text-[#0f766e]" /> سامانه چه می‌کند؟
          </h3>
          <ul className="list-inside list-disc space-y-2 text-[13px] leading-7 text-slate-600">
            <li>داوری جامع پروپوزال در ۱۱ بُعد با روبریک ۱۰۰ امتیازی شفاف و قابل تنظیم</li>
            <li>داوری مقاله با انتخاب خودکار راهنمای گزارش‌دهی متناسب با طرح مطالعه</li>
            <li>ممیزی آماری تخصصی: تناسب آزمون، فرض‌ها، توان، مخدوش‌گری و تفسیر</li>
            <li>راستی‌آزمایی واقعی منابع در Crossref، OpenAlex و PubMed</li>
            <li>ارزیابی آمادگی انتشار و تطبیق با الزامات مجله هدف</li>
            <li>شبیه‌سازی پنل چهار داور مستقل + سنتز سردبیری</li>
            <li>دستیار بازنگری: بازنویسی پیشنهادی با حفظ کامل یافته‌های مطالعه</li>
            <li>گزارش رسمی نویسندگان (A) و گزارش محرمانه سردبیر (B) با خروجی DOCX/PDF</li>
            <li>نامه پاسخ به داوران به‌صورت point-by-point و صادقانه</li>
          </ul>
        </div>

        <div className="rounded-2xl border bg-white p-6">
          <h3 className="mb-3 flex items-center gap-2 font-extrabold text-[#0e2a47]">
            <Users className="h-5 w-5 text-[#0f766e]" /> درباره طراح و سازنده
          </h3>
          <div className="rounded-2xl bg-[#f5f7fa] p-5 text-center">
            <div className="text-lg font-extrabold text-[#0e2a47]">سید مجتبی کاظمی</div>
            <div className="mt-1 text-sm text-slate-600">عضو هیئت علمی گروه پرستاری</div>
            <div className="text-sm text-slate-600">دانشکده علوم پزشکی بهبهان</div>
          </div>
          <p className="mt-4 text-[13px] leading-7 text-slate-600">
            این سامانه با هدف توانمندسازی پژوهشگران، داوران و کمیته‌های علمی در دانشگاه‌ها و مراکز تحقیقاتی ایران و جهان طراحی شده است؛
            ترکیبی از دانش روش‌شناسی پژوهش، اپیدمیولوژی، بیواستاتیستیک و تجربه داوری مجلات علمی.
          </p>
        </div>
      </div>

      {/* Standards library */}
      <div className="rounded-2xl border bg-white p-6">
        <h3 className="mb-1 flex items-center gap-2 font-extrabold text-[#0e2a47]">
          <BookOpenCheck className="h-5 w-5 text-[#0f766e]" /> کتابخانه استانداردهای بین‌المللی داوری
        </h3>
        <p className="mb-4 text-xs text-slate-500">
          این استانداردها مبنای چک‌لیست‌های داوری سامانه‌اند. منبع رسمی هر استاندارد برای به‌روزرسانی ذکر شده است.
        </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {GUIDELINES_CLIENT.map((g) => (
            <div key={g.key} className="card-hover rounded-2xl border bg-white p-4">
              <div className="text-sm font-extrabold text-[#0e2a47]" dir="ltr" style={{ textAlign: "right" }}>{g.name}</div>
              <div className="mt-0.5 text-xs text-teal-700">{g.faName}</div>
              <div className="mt-2 text-[11px] leading-5 text-slate-500">
                نسخه: {g.version} · سال: {faNum(g.year)}
                <br />
                {g.designs.join(" · ")}
              </div>
              <a href={g.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[11px] font-bold text-[#0f766e] hover:underline">
                منبع رسمی ↗
              </a>
            </div>
          ))}
        </div>
      </div>

      <Banner tone="info" title="اعلام مهم درباره محدودیت‌ها">
        پژوهش‌یار هوشمند ابزار کمکی است: هرگز ادعای تشخیص قطعی تخلف علمی، سرقت ادبی اثبات‌شده یا احتمال پذیرش عددی ندارد و
        جایگزین داوری انسانی مجاز یا تصمیم هیئت تحریریه نیست. همه قضاوت‌ها با ذکر محل و دلایل مستند در سند ارائه می‌شوند.
      </Banner>
    </div>
  );
}
