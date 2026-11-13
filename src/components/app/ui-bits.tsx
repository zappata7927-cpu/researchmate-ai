"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEVERITY_COLOR, SEVERITY_FA, faNum } from "@/lib/client";

// ---------------------------------------------------------------------------
// ScoreRing — circular score gauge
// ---------------------------------------------------------------------------
export function ScoreRing({
  value,
  size = 140,
  stroke = 12,
  label = "امتیاز کل",
  color,
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  label?: string;
  color?: string;
}) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === null) return;
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setDisplay(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const v = value ?? 0;
  const ringColor = color || (v >= 85 ? "#0f766e" : v >= 70 ? "#0891b2" : v >= 55 ? "#d97706" : v >= 40 ? "#ea580c" : "#dc2626");
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = value === null ? 0 : (display / 100) * c;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - filled }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </svg>
      <div className="-mt-[calc(50%+14px)] mb-[calc(50%-24px)] text-center">
        <div className="text-3xl font-extrabold font-num" style={{ color: ringColor }}>
          {value === null ? "—" : faNum(Math.round(display))}
        </div>
        <div className="text-[11px] text-muted-foreground">از ۱۰۰</div>
      </div>
      <div className="text-sm font-semibold text-foreground">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------
export function SeverityBadge({ severity }: { severity: string }) {
  const color = SEVERITY_COLOR[severity] || "#64748b";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {severity === "critical" && <AlertTriangle className="h-3 w-3" />}
      {SEVERITY_FA[severity] || severity}
    </span>
  );
}

export function StatusChip({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold"
      style={{ backgroundColor: `${color}18`, color }}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------
export function StatCard({
  title,
  value,
  hint,
  icon,
  tone = "navy",
}: {
  title: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "navy" | "teal" | "red" | "amber" | "slate";
}) {
  const tones: Record<string, string> = {
    navy: "bg-[#0e2a47] text-white",
    teal: "bg-[#e6f5f3] text-[#0f766e]",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="card-hover rounded-2xl border bg-white p-4 flex items-center gap-3">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tones[tone])}>{icon}</div>
      <div className="min-w-0">
        <div className="text-2xl font-extrabold font-num leading-none">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground truncate">{title}</div>
        {hint && <div className="text-[10px] text-muted-foreground/70 truncate">{hint}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading / empty / banner
// ---------------------------------------------------------------------------
export function LoadingPanel({ text = "در حال پردازش…" }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-white/60 p-10 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#0f766e]" />
      <div className="text-sm font-medium text-muted-foreground">{text}</div>
      <div className="max-w-md text-xs leading-6 text-muted-foreground/80">
        تحلیل هوش مصنوعی سند شما ممکن است چند دقیقه طول بکشد. این صفحه را نبندید.
      </div>
    </div>
  );
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-white/60 p-8 text-center">
      <div className="text-slate-400">{icon || <Info className="h-8 w-8" />}</div>
      <div className="font-semibold">{title}</div>
      {hint && <div className="max-w-md text-xs leading-6 text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Banner({
  tone,
  title,
  children,
}: {
  tone: "info" | "warn" | "danger" | "success";
  title?: string;
  children?: React.ReactNode;
}) {
  const map = {
    info: { bg: "bg-sky-50 border-sky-200 text-sky-900", icon: <Info className="h-4 w-4 shrink-0 text-sky-600" /> },
    warn: { bg: "bg-amber-50 border-amber-200 text-amber-900", icon: <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" /> },
    danger: { bg: "bg-red-50 border-red-200 text-red-900", icon: <XCircle className="h-4 w-4 shrink-0 text-red-600" /> },
    success: { bg: "bg-teal-50 border-teal-200 text-teal-900", icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600" /> },
  }[tone];
  return (
    <div className={cn("flex items-start gap-2 rounded-xl border p-3 text-[13px] leading-6", map.bg)}>
      {map.icon}
      <div>
        {title && <div className="font-bold">{title}</div>}
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress bar for subscores
// ---------------------------------------------------------------------------
export function WeightBar({ label, weight, score, note }: { label: string; weight: number; score: number | null; note?: string }) {
  const pct = score === null ? 0 : (score / 5) * 100;
  const color = score === null ? "#94a3b8" : pct >= 85 ? "#0f766e" : pct >= 70 ? "#0891b2" : pct >= 55 ? "#d97706" : pct >= 40 ? "#ea580c" : "#dc2626";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="font-num text-muted-foreground">
          {score === null ? "غیرقابل ارزیابی" : `${faNum(score)} از ۵`} · وزن {faNum(weight)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      {note && <div className="text-[11px] leading-5 text-muted-foreground">{note}</div>}
    </div>
  );
}
