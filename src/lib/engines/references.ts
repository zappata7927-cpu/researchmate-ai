/**
 * ResearchMate AI — Reference verification engine.
 * Phase 1: extract the reference list (AI-assisted, regex-assisted).
 * Phase 2: verify each reference against real scholarly APIs:
 *   - Crossref (https://api.crossref.org)  — metadata + DOI
 *   - OpenAlex (https://api.openalex.org)  — metadata + is_retracted flag
 *   - PubMed E-utilities (optional, for PMID lookup)
 * A failed search is NOT proof that a reference does not exist — the UI must
 * make that distinction clear ("unverified" vs "not found").
 */

import { z } from "zod";
import { chatJSON } from "../ai";
import { clip, SCIENTIFIC_INTEGRITY_PROMPT } from "./base";
import { referencesAuditSchema, type ReferenceCheck } from "../schemas";

const TIMEOUT_MS = 12000;

async function fetchJSON(url: string): Promise<any | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "ResearchMateAI/1.0 (academic reference verification; mailto:contact@example.org)",
      },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleSimilarity(a: string, b: string): number {
  const A = new Set(norm(a).split(" ").filter((w) => w.length > 2));
  const B = new Set(norm(b).split(" ").filter((w) => w.length > 2));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.max(A.size, B.size);
}

/** Verify one parsed reference against Crossref + OpenAlex (+ PubMed by PMID/term). */
export async function verifySingleReference(ref: {
  raw: string;
  title?: string;
  authors?: string;
  journal?: string;
  year?: string;
  doi?: string;
}): Promise<ReferenceCheck> {
  const check: ReferenceCheck = {
    raw: ref.raw,
    status: "unverified",
    retracted: false,
    note: null,
    foundTitle: null,
    foundAuthors: null,
    foundJournal: null,
    foundYear: null,
    doi: ref.doi || null,
    pmid: null,
    url: null,
  };

  // ---- 1) DOI-based verification (strongest) ----
  if (ref.doi) {
    const doi = ref.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim();
    const cr = await fetchJSON(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    if (cr?.message) {
      const m = cr.message;
      check.status = "verified";
      check.doi = doi;
      check.url = `https://doi.org/${doi}`;
      check.foundTitle = Array.isArray(m.title) ? m.title[0] : m.title || null;
      check.foundAuthors = Array.isArray(m.author)
        ? m.author.slice(0, 4).map((a: any) => [a.family, a.given].filter(Boolean).join(" ")).join(", ")
        : null;
      check.foundJournal = m["container-title"]?.[0] || null;
      check.foundYear = String(m.issued?.["date-parts"]?.[0]?.[0] || "");
      // Retraction / correction notices via Crossref update-to
      const updType = String(m["update-to"]?.[0]?.type || m.updateType || "").toLowerCase();
      if (updType.includes("retraction")) {
        check.status = "possibly_retracted";
        check.retracted = true;
        check.note = "Crossref نشان‌گر بازنشانی (retraction) برای این DOI ثبت کرده است.";
      } else if (updType.includes("correction") || updType.includes("amendment")) {
        check.status = "verified";
        check.note = "Crossref اصلاحیه/آمندمنت برای این DOI ثبت کرده است؛ نسخه اصلاح‌شده را بررسی کنید.";
      }
      if (ref.title && titleSimilarity(ref.title, check.foundTitle || "") < 0.4) {
        check.status = "wrong_metadata";
        check.note = "DOI یافت شد اما عنوان دریافتی با عنوان استناد هم‌خوانی ندارد؛ احتمال خطای متادیتا.";
      }
      return check;
    }
    // DOI provided but explicitly not registered in Crossref
    check.status = "doi_not_found";
    check.note = "DOI در Crossref ثبت نشده است؛ ممکن است DOI جعلی، قدیمی یا نادرست باشد. با جست‌وجوی عنوان ادامه می‌دهیم.";
  }

  // ---- 2) Title-based search (Crossref then OpenAlex) ----
  const title = ref.title || ref.raw;
  if (!title || title.length < 12) {
    check.note = (check.note ? check.note + " " : "") + "عنوان قابل جست‌وجو استخراج نشد؛ راستی‌آزمایی خودکار ممکن نیست.";
    return check;
  }

  const crSearch = await fetchJSON(
    `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(title)}&rows=3`
  );
  const candidates: any[] = crSearch?.message?.items || [];
  let best: any = null;
  let bestScore = 0;
  for (const c of candidates) {
    const t = Array.isArray(c.title) ? c.title[0] : c.title || "";
    const sim = titleSimilarity(title, t);
    if (sim > bestScore) {
      bestScore = sim;
      best = c;
    }
  }
  if (best && bestScore >= 0.55) {
    check.status = bestScore >= 0.85 ? "verified" : "partial";
    check.foundTitle = Array.isArray(best.title) ? best.title[0] : best.title;
    check.foundAuthors = Array.isArray(best.author)
      ? best.author.slice(0, 4).map((a: any) => [a.family, a.given].filter(Boolean).join(" ")).join(", ")
      : null;
    check.foundJournal = best["container-title"]?.[0] || null;
    check.foundYear = String(best.issued?.["date-parts"]?.[0]?.[0] || "");
    check.doi = best.DOI || check.doi || null;
    check.url = best.DOI ? `https://doi.org/${best.DOI}` : null;
    if (ref.journal && check.foundJournal && norm(ref.journal) !== norm(check.foundJournal) && bestScore < 0.85) {
      check.status = "wrong_metadata";
      check.note = "عنوان یافت شد اما نام مجله در استناد با متادیتای Crossref هم‌خوان نیست.";
    }
    if (ref.year && check.foundYear && ref.year !== check.foundYear) {
      check.note = (check.note ? check.note + " " : "") + `سال استناد (${ref.year}) با سال انتشار (${check.foundYear}) متفاوت است.`;
      if (check.status === "verified") check.status = "partial";
    }
    return check;
  }

  // ---- 3) OpenAlex (adds is_retracted) ----
  const oa = await fetchJSON(
    `https://api.openalex.org/works?search=${encodeURIComponent(title)}&per-page=3&select=id,doi,title,display_name,authorships,primary_location,publication_year,is_retracted`
  );
  if (oa?.results?.length) {
    for (const w of oa.results) {
      const t = w.display_name || w.title || "";
      if (titleSimilarity(title, t) >= 0.55) {
        check.status = "partial";
        check.foundTitle = t;
        check.foundAuthors = (w.authorships || []).slice(0, 4).map((a: any) => a.author?.display_name).filter(Boolean).join(", ");
        check.foundJournal = w.primary_location?.source?.display_name || null;
        check.foundYear = String(w.publication_year || "");
        check.doi = w.doi ? String(w.doi).replace("https://doi.org/", "") : check.doi;
        check.url = w.doi || w.id || null;
        if (w.is_retracted) {
          check.status = "possibly_retracted";
          check.retracted = true;
          check.note = "OpenAlex این اثر را بازنشده‌شده (retracted) علامت‌گذاری کرده است.";
        } else {
          check.note = "در OpenAlex یافت شد (تطابق جزئی عنوان)؛ تطابق کامل تأیید نشد.";
        }
        return check;
      }
    }
  }

  // ---- 4) PubMed as last resort (title search) ----
  const es = await fetchJSON(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=1&term=${encodeURIComponent(title)}`
  );
  const pmid = es?.esearchresult?.idlist?.[0];
  if (pmid) {
    const sum = await fetchJSON(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${pmid}`
    );
    const doc = sum?.result?.[pmid];
    if (doc) {
      const t = doc.title || "";
      const sim = titleSimilarity(title, t);
      if (sim >= 0.5) {
        check.status = sim >= 0.8 ? "verified" : "partial";
        check.pmid = pmid;
        check.foundTitle = t;
        check.foundAuthors = (doc.authors || []).slice(0, 4).map((a: any) => a.name).join(", ");
        check.foundJournal = doc.fulljournalname || doc.source || null;
        check.foundYear = String(doc.pubdate || "").slice(0, 4);
        check.url = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
        return check;
      }
    }
  }

  check.status = check.status === "doi_not_found" ? "doi_not_found" : "unverified";
  check.note =
    (check.note ? check.note + " " : "") +
    "در Crossref، OpenAlex و PubMed با تطابق کافی یافت نشد. «یافت‌نشدن» به‌معنای وجود نداشتن سند نیست؛ ممکن است استناد متعلق به کتاب، کنفرانس، مجله غیرنمایه‌شده یا با متادیتای متفاوت باشد.";
  return check;
}

/** Extract the references section via AI with structured output. */
export async function extractReferencesAI(text: string) {
  const system = `تو موتور استخراج فهرست منابع است. فقط منابع واقعاً موجود در «فهرست منابع/References» سند را استخراج می‌کنی؛ هیچ منبعی نمی‌سازی.
برای هر منبع تا حد امکان این اجزا را جدا کن: raw (کل سطر استناد)، title، authors، journal، year، doi.
${SCIENTIFIC_INTEGRITY_PROMPT}`;

  const user = `فهرست منابع این سند را استخراج کن. اگر فهرست منابع وجود ندارد، آرایه خالی بده و در summary صریح بگو «فهرست منابع یافت نشد».

سند:
"""
${clip(text, 45000)}
"""

ساختار JSON:
{"summary": "...", "totalFound": عدد, "references": [{"index": شماره, "raw": "...", "title": "...", "authors": "...", "journal": "...", "year": "...", "doi": "..."}]}`;

  const { data } = await chatJSON(
    system,
    user,
    (d) =>
      z
        .object({
          summary: z.string().catch(""),
          totalFound: z.number().catch(0),
          references: z
            .array(
              z.object({
                index: z.number().catch(0),
                raw: z.string().catch(""),
                title: z.string().optional().nullable().catch(null),
                authors: z.string().optional().nullable().catch(null),
                journal: z.string().optional().nullable().catch(null),
                year: z.string().optional().nullable().catch(null),
                doi: z.string().optional().nullable().catch(null),
              })
            )
            .catch([]),
        })
        .parse(d),
    { maxChars: 45000 }
  );
  return data;
}
