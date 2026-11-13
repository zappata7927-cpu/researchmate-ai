"use client";

import { useState, useSyncExternalStore } from "react";
import {
  BookOpenCheck,
  Calculator,
  FileEdit,
  FileText,
  FlaskConical,
  History,
  Home,
  Info,
  Menu,
  Newspaper,
  Send,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Hash-navigation safety net
// ---------------------------------------------------------------------------
// Next.js <Link> (and next/navigation router.push) intercept clicks and call
// history.pushState, which — unlike a native anchor navigation — does NOT fire
// the `hashchange` event. This app routes on the URL hash, so we patch
// pushState/replaceState once to dispatch `hashchange` whenever the hash
// actually changes. Keeps routing in sync no matter what triggered it.
if (typeof window !== "undefined" && !(window as any).__hashNavPatched) {
  (window as any).__hashNavPatched = true;
  const origPush = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);
  const fireIfChanged = () => {
    if ((window as any).__hashNavLast !== window.location.hash) {
      (window as any).__hashNavLast = window.location.hash;
      window.dispatchEvent(new Event("hashchange"));
    }
  };
  (window as any).__hashNavLast = window.location.hash;
  history.pushState = function (...args: Parameters<History["pushState"]>) {
    const res = origPush(...args);
    fireIfChanged();
    return res;
  };
  history.replaceState = function (...args: Parameters<History["replaceState"]>) {
    const res = origReplace(...args);
    fireIfChanged();
    return res;
  };
}

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "#/", label: "خانه", icon: <Home className="h-4 w-4" /> },
  { href: "#/new/proposal", label: "داوری پروپوزال", icon: <FileText className="h-4 w-4" /> },
  { href: "#/new/manuscript", label: "داوری مقاله", icon: <Newspaper className="h-4 w-4" /> },
  { href: "#/new/stats", label: "ممیزی آماری", icon: <Calculator className="h-4 w-4" /> },
  { href: "#/new/references", label: "بررسی منابع", icon: <BookOpenCheck className="h-4 w-4" /> },
  { href: "#/new/journal", label: "آمادگی انتشار", icon: <Send className="h-4 w-4" /> },
  { href: "#/new/reviewers", label: "شبیه‌سازی داوران", icon: <FlaskConical className="h-4 w-4" /> },
  { href: "#/new/revision", label: "دستیار بازنگری", icon: <FileEdit className="h-4 w-4" /> },
  { href: "#/history", label: "تاریخچه و گزارش‌ها", icon: <History className="h-4 w-4" /> },
  { href: "#/settings", label: "تنظیمات و استانداردها", icon: <Settings className="h-4 w-4" /> },
  { href: "#/about", label: "درباره سامانه", icon: <Info className="h-4 w-4" /> },
];

// ---------------------------------------------------------------------------
// Hash-router store (useSyncExternalStore)
// ---------------------------------------------------------------------------
// A tiny module-level store for the current URL hash. `useSyncExternalStore`
// gives us SSR-safe hydration (server snapshot "#/") and instant updates for
// every navigation source: native anchor clicks, back/forward (popstate) and
// programmatic pushState/replaceState (patched below).
const hashListeners = new Set<() => void>();

function subscribeHash(cb: () => void) {
  hashListeners.add(cb);
  return () => {
    hashListeners.delete(cb);
  };
}

function getClientHash() {
  return typeof window === "undefined" ? "#/" : window.location.hash || "#/";
}

function getServerHash() {
  return "#/";
}

if (typeof window !== "undefined") {
  const notify = () => hashListeners.forEach((l) => l());
  window.addEventListener("hashchange", notify);
  window.addEventListener("popstate", notify);
}

export function useHashRoute(): string {
  return useSyncExternalStore(subscribeHash, getClientHash, getServerHash);
}

/**
 * Plain anchor for hash routes. Native navigation fires `hashchange`, which is
 * what our router listens to. (Next.js <Link> uses pushState and would break
 * hash routing without the safety net above.)
 */
export function HashLink({
  href,
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl bg-gradient-to-br from-[#0e2a47] to-[#0f766e] text-white shadow-md"
      style={{ width: size, height: size }}
    >
      <Sparkles className="h-1/2 w-1/2" />
    </div>
  );
}

export function AppShell({
  active,
  aiConfigured,
  children,
}: {
  active: string;
  aiConfigured: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "#/") return active === "#/" || active === "";
    return active.startsWith(href);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#dbe3ec] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-lg border hover:bg-slate-50 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="باز و بسته کردن منو"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <HashLink href="#/" className="flex items-center gap-3">
            <Logo />
            <div className="leading-tight">
              <div className="text-base font-extrabold text-[#0e2a47]">پژوهش‌یار هوشمند</div>
              <div className="text-[10px] font-medium tracking-wide text-[#0f766e]">ResearchMate AI</div>
            </div>
          </HashLink>
          <div className="mx-auto hidden items-center gap-2 md:flex">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold",
                aiConfigured ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"
              )}
              title={aiConfigured ? "سرویس هوش مصنوعی فعال است" : "سرویس هوش مصنوعی پیکربندی نشده است"}
            >
              <span className={cn("h-2 w-2 rounded-full", aiConfigured ? "bg-teal-500" : "bg-amber-500")} />
              {aiConfigured ? "موتور تحلیل فعال" : "موتور تحلیل غیرفعال"}
            </span>
          </div>
          <div className="mr-auto flex items-center gap-2 lg:mr-0">
            <HashLink
              href="#/settings"
              className={cn(
                "hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-slate-100 sm:flex",
                isActive("#/settings") && "bg-slate-100 text-[#0f766e]"
              )}
            >
              <Settings className="h-4 w-4" />
              تنظیمات
            </HashLink>
            <HashLink
              href="#/about"
              className={cn(
                "hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-slate-100 sm:flex",
                isActive("#/about") && "bg-slate-100 text-[#0f766e]"
              )}
            >
              <Info className="h-4 w-4" />
              درباره
            </HashLink>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-24 hidden h-fit w-60 shrink-0 flex-col gap-1 rounded-2xl border bg-white p-3 lg:flex">
          {NAV_ITEMS.map((item) => (
            <HashLink
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                isActive(item.href)
                  ? "bg-[#e6f5f3] font-bold text-[#0f766e]"
                  : "text-slate-600 hover:bg-slate-50 hover:text-[#0e2a47]"
              )}
            >
              {item.icon}
              {item.label}
            </HashLink>
          ))}
          <div className="mt-3 rounded-xl bg-[#f5f7fa] p-3 text-[11px] leading-5 text-slate-500">
            پردازش اسناد فقط سمت سرور انجام می‌شود و برای آموزش مدل‌ها به‌کار نمی‌رود.
          </div>
        </aside>

        {/* Mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <nav className="absolute right-0 top-0 flex h-full w-72 flex-col gap-1 overflow-y-auto bg-white p-4 shadow-xl">
              <div className="mb-3 flex items-center gap-2">
                <Logo size={34} />
                <div className="text-sm font-extrabold text-[#0e2a47]">پژوهش‌یار هوشمند</div>
              </div>
              {NAV_ITEMS.map((item) => (
                <HashLink
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    isActive(item.href) ? "bg-[#e6f5f3] font-bold text-[#0f766e]" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {item.icon}
                  {item.label}
                </HashLink>
              ))}
            </nav>
          </div>
        )}

        {/* Main content */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Footer — sticky bottom */}
      <footer className="mt-auto border-t border-[#dbe3ec] bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-1.5 px-4 py-4 text-center">
          <div className="text-sm font-bold text-[#0e2a47]">طراح و سازنده: سید مجتبی کاظمی</div>
          <div className="text-xs text-muted-foreground">عضو هیئت علمی گروه پرستاری، دانشکده علوم پزشکی بهبهان</div>
          <div className="text-[11px] leading-5 text-muted-foreground/80">
            پژوهش‌یار هوشمند ابزار کمکی داوری است و جایگزین قضاوت داور انسانی، کمیته اخلاق یا تصمیم هیئت تحریریه نیست.
          </div>
        </div>
      </footer>
    </div>
  );
}
