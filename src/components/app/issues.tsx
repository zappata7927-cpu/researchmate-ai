"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Quote, MapPin, Lightbulb, Wrench, ShieldCheck, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_FA, SEVERITY_COLOR, faNum } from "@/lib/client";
import { SeverityBadge } from "./ui-bits";

/**
 * IssueCard — the mandatory 10-part weakness structure (spec section 10):
 * 1 title, 2 severity, 3 location, 4 excerpt, 5 explanation, 6 why it matters,
 * 7 suggestion, 8 detailed solution, 9 suggested text, 10 guideline
 */
function IssueRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-1.5">
      <div className="mt-0.5 shrink-0 text-[#0f766e]">{icon}</div>
      <div className="min-w-0 text-[13px] leading-6">
        <span className="font-bold text-[#0e2a47]">{label}: </span>
        <span className="text-slate-700">{children}</span>
      </div>
    </div>
  );
}

export function IssueCard({ issue, index }: { issue: any; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const color = SEVERITY_COLOR[issue.severity] || "#64748b";

  return (
    <motion.div
      layout
      className="overflow-hidden rounded-2xl border bg-white"
      style={{ borderRight: `4px solid ${color}` }}
    >
      <button className="flex w-full items-center gap-3 p-4 text-right" onClick={() => setOpen((v) => !v)}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold" style={{ background: `${color}18`, color }}>
          {faNum(index + 1)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-[#0e2a47]">{issue.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <SeverityBadge severity={issue.severity} />
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {CATEGORY_FA[issue.category] || issue.category}
            </span>
            {issue.guideline && (
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">{issue.guideline}</span>
            )}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition", open && "rotate-180")} />
      </button>
      {open && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-1 border-t border-dashed px-4 pb-3 pt-2">
          <IssueRow icon={<MapPin className="h-4 w-4" />} label="محل دقیق در سند">{issue.location || "—"}</IssueRow>
          {issue.excerpt && (
            <IssueRow icon={<Quote className="h-4 w-4" />} label="نقل‌قول مرتبط">
              <span className="rounded bg-slate-50 px-1.5 py-0.5 italic">{issue.excerpt}</span>
            </IssueRow>
          )}
          <IssueRow icon={<Lightbulb className="h-4 w-4" />} label="توضیح علمی">{issue.explanation || "—"}</IssueRow>
          <IssueRow icon={<ShieldCheck className="h-4 w-4" />} label="چرا این ایراد مهم است">{issue.whyMatters || "—"}</IssueRow>
          <IssueRow icon={<PenLine className="h-4 w-4" />} label="پیشنهاد اصلاح">{issue.suggestion || "—"}</IssueRow>
          <IssueRow icon={<Wrench className="h-4 w-4" />} label="راه‌حل عملی گام‌به‌گام">{issue.detailedSolution || "—"}</IssueRow>
          {issue.suggestedText && (
            <div className="rounded-xl bg-[#e6f5f3]/60 p-3 text-[13px] leading-7">
              <span className="font-bold text-[#0f766e]">متن پیشنهادی جایگزین: </span>
              {issue.suggestedText}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

export function IssuesList({ issues }: { issues: any[] }) {
  const order: Record<string, number> = { critical: 0, major: 1, moderate: 2, minor: 3 };
  const sorted = [...issues].sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  return (
    <div className="space-y-3">
      {sorted.map((iss, i) => (
        <IssueCard key={i} issue={iss} index={i} />
      ))}
    </div>
  );
}
