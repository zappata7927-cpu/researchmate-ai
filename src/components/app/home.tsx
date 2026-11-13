"use client";

import { motion } from "framer-motion";
import {
  BookOpenCheck,
  Calculator,
  FileText,
  Newspaper,
  Send,
  ShieldCheck,
  BookMarked,
  ScanSearch,
  Users,
  ArrowLeft,
} from "lucide-react";
import { StatCard, Banner } from "./ui-bits";
import { HashLink } from "./shell";
import { DOC_TYPE_FA, RECOMMENDATION_FA, faDate, faNum } from "@/lib/client";

const ACTIONS = [
  { href: "#/new/proposal", title: "داوری پروپوزال", desc: "ارزیابی ۱۱ بُعدی پروپوزال با روبریک ۱۰۰ امتیازی", icon: <FileText className="h-6 w-6" />, color: "#0e2a47" },
  { href: "#/new/manuscript", title: "داوری مقاله", desc: "داوری کامل مقاله با چک‌لیست راهنمای گزارش‌دهی متناسب", icon: <Newspaper className="h-6 w-6" />, color: "#0f766e" },
  { href: "#/new/stats", title: "ممیزی آماری", desc: "بررسی تناسب آزمون‌ها، فرض‌ها، حجم نمونه و تفسیر", icon: <Calculator className="h-6 w-6" />, color: "#0891b2" },
  { href: "#/new/references", title: "بررسی منابع", desc: "راستی‌آزمایی واقعی منابع در Crossref، OpenAlex و PubMed", icon: <BookOpenCheck className="h-6 w-6" />, color: "#b45309" },
  { href: "#/new/journal", title: "ارزیابی آمادگی انتشار", desc: "تطبیق مقاله با الزامات مجله هدف و برآورد آمادگی", icon: <Send className="h-6 w-6" />, color: "#7c3aed" },
];

const FEATURES = [
  {
    icon: <BookMarked className="h-5 w-5" />,
    title: "کتابخانه استانداردها",
    desc: "CONSORT 2025، STROBE، PRISMA 2020، SPIRIT، STARD، TRIPOD+AI، CARE، COREQ، ARRIVE 2.0، SQUIRE، CHEERS 2022، ICMJE و COPE",
  },
  {
    icon: <ScanSearch className="h-5 w-5" />,
    title: "شفافیت علمی",
    desc: "تمایز صریح میان «یافت‌نشدن» و «وجود نداشتن»، علامت‌گذاری اطلاعات غیرقابل ارزیابی، پرهیز کامل از ساخت منبع یا نتیجه",
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: "پنل داوری شبیه‌سازی‌شده",
    desc: "چهار داور مستقل: کارشناس موضوع، متدولوژیست، بیواستاتیستین و سردبیر — به‌همراه سنتز سردبیری",
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: "حریم خصوصی پژوهش",
    desc: "پردازش سمت سرور، عدم استفاده از اسناد برای آموزش مدل، رعایت اصول رازداری ICMJE و COPE",
  },
];

export function HomeView({
  projects,
  aiConfigured,
}: {
  projects: any[];
  aiConfigured: boolean;
}) {
  const total = projects.length;
  const withScore = projects.filter((p) => typeof p.totalScore === "number");
  const avg = withScore.length ? Math.round(withScore.reduce((s, p) => s + p.totalScore, 0) / withScore.length) : null;
  const criticals = projects.reduce((s, p) => s + (p.criticalCount || 0), 0);
  const recent = projects.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="hero-gradient fade-up overflow-hidden rounded-3xl border bg-white p-8 text-center md:p-12">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-1.5 text-xs font-bold text-teal-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            داوری علمی مبتنی بر شواهد — بدون ساخت منبع، بدون ادعای اثبات‌نشده
          </div>
          <h1 className="text-4xl font-extrabold leading-tight text-[#0e2a47] md:text-5xl">پژوهش‌یار هوشمند</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
            سامانه هوشمند ارزیابی، داوری و ارتقای کیفیت پژوهش
          </p>
          <p className="mt-1 text-xs font-medium tracking-wide text-[#0f766e] md:text-sm">
            From Research Submission to Scientific Excellence
          </p>

          <div className="mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-3 md:grid-cols-5">
            {ACTIONS.map((a, i) => (
              <motion.div key={a.href} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i }}>
                <HashLink
                  href={a.href}
                  className="card-hover group flex h-full flex-col items-center gap-2 rounded-2xl border bg-white p-4 text-center"
                  style={{ borderColor: `${a.color}22` }}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: `${a.color}12`, color: a.color }}>
                    {a.icon}
                  </span>
                  <span className="text-sm font-extrabold text-[#0e2a47]">{a.title}</span>
                  <span className="hidden text-[11px] leading-5 text-slate-500 md:block">{a.desc}</span>
                </HashLink>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {!aiConfigured && (
        <Banner tone="warn" title="موتور تحلیل هوش مصنوعی پیکربندی نشده است">
          بارگذاری، استخراج متن، تاریخچه و گزارش‌های قبلی کار می‌کنند؛ برای تحلیل هوشمند، در فایل <code>.env</code> مقادیر{" "}
          <code>AI_BASE_URL</code>، <code>AI_API_KEY</code> و <code>AI_MODEL</code> را تنظیم کنید (راهنما در صفحه تنظیمات و README).
        </Banner>
      )}

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="پروژه‌های داوری‌شده" value={faNum(total)} icon={<FileText className="h-5 w-5" />} tone="navy" />
        <StatCard title="میانگین امتیاز کل" value={avg === null ? "—" : faNum(avg)} hint="از ۱۰۰" icon={<Send className="h-5 w-5" />} tone="teal" />
        <StatCard title="ایرادهای بحرانی شناسایی‌شده" value={faNum(criticals)} icon={<ShieldCheck className="h-5 w-5" />} tone="red" />
        <StatCard title="استانداردهای پشتیبانی‌شده" value={faNum(14)} hint="EQUATOR، ICMJE، COPE، NIH" icon={<BookMarked className="h-5 w-5" />} tone="amber" />
      </section>

      {/* Recent projects */}
      <section className="rounded-2xl border bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[#0e2a47]">آخرین پروژه‌ها</h2>
          <HashLink href="#/history" className="flex items-center gap-1 text-xs font-bold text-[#0f766e] hover:underline">
            مشاهده همه
            <ArrowLeft className="h-3.5 w-3.5" />
          </HashLink>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            هنوز پروژه‌ای داوری نشده است. با یکی از دکمه‌های بالا شروع کنید — برای شروع سریع، <HashLink href="#/new/proposal" className="font-bold text-[#0f766e] underline">داوری پروپوزال</HashLink> پیشنهاد می‌شود.
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((p) => (
              <HashLink key={p.id} href={`#/project/${p.id}`} className="card-hover flex items-center gap-3 rounded-xl border bg-white p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f5f7fa] font-num text-sm font-extrabold text-[#0e2a47]">
                  {p.totalScore == null ? "—" : faNum(Math.round(p.totalScore))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{p.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {DOC_TYPE_FA[p.docType] || p.docType} · {faDate(p.createdAt)}
                  </span>
                </span>
                {p.recommendation && (
                  <span className="hidden rounded-full bg-[#e6f5f3] px-3 py-1 text-[11px] font-bold text-[#0f766e] sm:block">
                    {RECOMMENDATION_FA[p.recommendation] || p.recommendation}
                  </span>
                )}
              </HashLink>
            ))}
          </div>
        )}
      </section>

      {/* Feature cards */}
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="card-hover rounded-2xl border bg-white p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6f5f3] text-[#0f766e]">{f.icon}</div>
            <div className="text-sm font-extrabold text-[#0e2a47]">{f.title}</div>
            <div className="mt-1.5 text-xs leading-6 text-slate-500">{f.desc}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
