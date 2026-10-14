import type { SnapFile } from "./movements";

/**
 * Pick the two latest valid weekly snapshots (data/weekly/YYYY-MM-DD.json),
 * the same files the public API reads, and turn them into the SnapFile shape
 * used by the /movements diff. Pure: callers inject the file listing/loader.
 */

export const WEEK_FILE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TOP_N = 200;

export type WeeklyCompanyRow = {
  slug: string;
  name?: string | null;
  publicUsd?: number | null;
  ghBeneficiaries?: number | null;
  collectives?: unknown[] | null;
  hold?: unknown;
  exclusionNote?: unknown;
};

export type ParsedWeekly = {
  week: string;
  companies: WeeklyCompanyRow[];
  blocked: Set<string>;
  fingerprint: string;
};

/** Validate a raw weekly file. Returns null when malformed (never throws). */
export function parseWeekly(week: string, raw: unknown): ParsedWeekly | null {
  if (!WEEK_FILE_RE.test(week)) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.date !== week) return null;
  if (!Array.isArray(r.companies) || r.companies.length === 0) return null;
  const companies: WeeklyCompanyRow[] = [];
  for (const c of r.companies) {
    if (!c || typeof c !== "object") return null;
    const slug = (c as Record<string, unknown>).slug;
    if (typeof slug !== "string" || !slug) return null;
    companies.push(c as WeeklyCompanyRow);
  }
  const blocked = new Set<string>();
  for (const c of companies) if (c.hold || c.exclusionNote) blocked.add(c.slug.toLowerCase());
  if (Array.isArray(r.excludedNoted)) {
    for (const e of r.excludedNoted) {
      const s = e && typeof e === "object" ? (e as Record<string, unknown>).slug : null;
      if (typeof s === "string" && s) blocked.add(s.toLowerCase());
    }
  }
  const held = (r.diff as Record<string, unknown> | undefined)?.held;
  if (Array.isArray(held)) {
    for (const h of held) {
      const s = h && typeof h === "object" ? (h as Record<string, unknown>).slug : null;
      if (typeof s === "string" && s) blocked.add(s.toLowerCase());
    }
  }
  const fingerprint = typeof r.runId === "string" || typeof r.runId === "number" ? String(r.runId) : week;
  return { week, companies, blocked, fingerprint };
}

export type LatestPair =
  | { status: "ok"; prev: ParsedWeekly; curr: ParsedWeekly; skipped: string[] }
  | { status: "insufficient"; only: ParsedWeekly | null; skipped: string[] };

/**
 * Walk weeks newest-first and keep the first two that parse. Malformed or
 * unreadable files are skipped (and reported), never fatal.
 */
export async function selectLatestTwo(
  weeks: Iterable<string>,
  load: (week: string) => Promise<unknown>,
): Promise<LatestPair> {
  const sorted = [...new Set(weeks)].filter((w) => WEEK_FILE_RE.test(w)).sort().reverse();
  const found: ParsedWeekly[] = [];
  const skipped: string[] = [];
  for (const week of sorted) {
    let raw: unknown;
    try {
      raw = await load(week);
    } catch {
      skipped.push(week);
      continue;
    }
    const parsed = parseWeekly(week, raw);
    if (!parsed) {
      skipped.push(week);
      continue;
    }
    found.push(parsed);
    if (found.length === 2) return { status: "ok", curr: found[0]!, prev: found[1]!, skipped };
  }
  return { status: "insufficient", only: found[0] ?? null, skipped };
}

/** Convert a weekly snapshot to the SnapFile shape (ranked top 200 by public USD). */
export function weeklyToSnap(w: ParsedWeekly, hidden: (slug: string) => boolean = () => false): SnapFile {
  const rows = w.companies
    .filter((c) => !w.blocked.has(c.slug.toLowerCase()) && !hidden(c.slug.toLowerCase()))
    .map((c) => ({
      slug: c.slug,
      name: typeof c.name === "string" && c.name ? c.name : c.slug,
      publicUsd: typeof c.publicUsd === "number" && Number.isFinite(c.publicUsd) ? c.publicUsd : 0,
      projects: Array.isArray(c.collectives) ? c.collectives.length : 0,
      ghBeneficiaries: typeof c.ghBeneficiaries === "number" ? c.ghBeneficiaries : 0,
    }));
  const order = [...rows].sort((a, b) => b.publicUsd - a.publicUsd || a.slug.localeCompare(b.slug));
  const rankBy = new Map<string, number>();
  order.forEach((r, i) => {
    if (i < TOP_N && r.publicUsd > 0) rankBy.set(r.slug, i + 1);
  });
  const index = rows.map((r) => ({ ...r, rank: rankBy.get(r.slug) ?? null }));
  const publicUsdAll = round2(index.reduce((s, r) => s + r.publicUsd, 0));
  const publicUsdRanked = round2(index.filter((r) => r.rank != null).reduce((s, r) => s + r.publicUsd, 0));
  return {
    meta: {
      collectedAt: w.week,
      hash: w.fingerprint,
      companies: index.length,
      sponsorships: 0,
      ranked: rankBy.size,
      publicUsdAll,
      publicUsdRanked,
    },
    index,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
