import { buildMovementsFromSnaps, type SnapFile } from "@/lib/movements";
import type { Meta, MovementsPayload } from "@/lib/types";

/**
 * Pick the two latest valid weekly snapshots (data/weekly/YYYY-MM-DD.json),
 * the same files the public API reads, and turn them into the SnapFile shape
 * used by the /movements diff. Pure: callers inject the file listing/loader.
 */

export const WEEK_FILE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TOP_N = 200;

/** Off-cycle marker as written by the scraper: boolean true or the string "true". */
export function isOffCycle(value: unknown): boolean {
  return value === true || value === "true";
}

/** The weeks that are official (valid date, file loads, not off-cycle), newest first. */
export async function officialWeeksFrom(
  weeks: Iterable<string>,
  load: (week: string) => Promise<unknown>,
): Promise<string[]> {
  const out: string[] = [];
  for (const week of [...new Set(weeks)].filter(isRealWeek).sort().reverse()) {
    try {
      const raw = await load(week);
      if (raw && typeof raw === "object" && !isOffCycle((raw as Record<string, unknown>).offCycle)) out.push(week);
    } catch {
      // unreadable: not listed
    }
  }
  return out;
}

export type WeeklyCompanyRow = {
  slug: string;
  name?: string | null;
  publicUsd?: number | null;
  ghBeneficiaries?: number | null;
  collectives?: unknown[] | null;
  beneficiaries?: unknown[] | null;
  hold?: unknown;
  exclusionNote?: unknown;
};

export type ParsedWeekly = {
  week: string;
  companies: WeeklyCompanyRow[];
  blocked: Set<string>;
  /** Weekly scraper run id (GitHub Actions run), or the week when absent. */
  fingerprint: string;
  /** Renames recorded by the scraper's stable-ID matching (diff.renamed): old -> new. */
  renamed: Map<string, string>;
  /** New and gone slugs as recorded by the scraper (diff.new_sponsors / disappeared_sponsors). */
  newSlugs: string[];
  goneSlugs: string[];
  /** Rows skipped as invalid (negative or non-numeric publicUsd). */
  warnings: string[];
};

/** YYYY-MM-DD that is also a real calendar date (rejects 2026-13-99). */
export function isRealWeek(week: string): boolean {
  if (!WEEK_FILE_RE.test(week)) return false;
  const d = new Date(`${week}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === week;
}

/** Validate a raw weekly file. Returns null when malformed (never throws). */
export function parseWeekly(week: string, raw: unknown): ParsedWeekly | null {
  if (!isRealWeek(week)) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.date !== week) return null;
  // Off-cycle runs (allow_off_cycle) are never the official week.
  if (isOffCycle(r.offCycle)) return null;
  if (!Array.isArray(r.companies) || r.companies.length === 0) return null;
  const companies: WeeklyCompanyRow[] = [];
  const warnings: string[] = [];
  for (const c of r.companies) {
    if (!c || typeof c !== "object") return null;
    const slug = (c as Record<string, unknown>).slug;
    if (typeof slug !== "string" || !slug) return null;
    const usd = (c as Record<string, unknown>).publicUsd;
    if (usd != null && (typeof usd !== "number" || !Number.isFinite(usd) || usd < 0)) {
      warnings.push(`${week}: ${slug} has invalid publicUsd ${JSON.stringify(usd)}; row skipped`);
      continue;
    }
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
  const diff = (r.diff && typeof r.diff === "object" ? r.diff : {}) as Record<string, unknown>;
  const held = diff.held;
  if (Array.isArray(held)) {
    for (const h of held) {
      const s = h && typeof h === "object" ? (h as Record<string, unknown>).slug : null;
      if (typeof s === "string" && s) blocked.add(s.toLowerCase());
    }
  }
  const fingerprint = typeof r.runId === "string" || typeof r.runId === "number" ? String(r.runId) : week;
  const renamed = new Map<string, string>();
  for (const x of rows(diff.renamed)) {
    if (typeof x.from === "string" && typeof x.to === "string" && x.from && x.to) {
      renamed.set(x.from.toLowerCase(), x.to.toLowerCase());
    }
  }
  const slugsOf = (v: unknown) =>
    rows(v).map((x) => x.slug).filter((x): x is string => typeof x === "string" && !!x).map((x) => x.toLowerCase());
  return {
    week,
    companies,
    blocked,
    fingerprint,
    renamed,
    newSlugs: slugsOf(diff.new_sponsors),
    goneSlugs: slugsOf(diff.disappeared_sponsors),
    warnings,
  };
}

function rows(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : [];
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
  const all = [...new Set(weeks)];
  const sorted = all.filter(isRealWeek).sort().reverse();
  const found: ParsedWeekly[] = [];
  const skipped: string[] = all.filter((w) => WEEK_FILE_RE.test(w) && !isRealWeek(w));
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
export function weeklyToSnap(
  w: ParsedWeekly,
  hidden: (slug: string) => boolean = () => false,
  rekey: (slug: string) => string = (s) => s,
): SnapFile {
  const rows = w.companies
    .filter((c) => !w.blocked.has(c.slug.toLowerCase()) && !hidden(c.slug.toLowerCase()))
    .map((c) => ({
      slug: rekey(c.slug.toLowerCase()),
      name: typeof c.name === "string" && c.name ? c.name : c.slug,
      publicUsd: typeof c.publicUsd === "number" && Number.isFinite(c.publicUsd) ? c.publicUsd : 0,
      projects: Array.isArray(c.collectives) ? c.collectives.length : 0,
      ghBeneficiaries: typeof c.ghBeneficiaries === "number" ? c.ghBeneficiaries : 0,
      links: (Array.isArray(c.collectives) ? c.collectives.length : 0) + (Array.isArray(c.beneficiaries) ? c.beneficiaries.length : 0),
    }));
  const order = [...rows].sort((a, b) => b.publicUsd - a.publicUsd || a.slug.localeCompare(b.slug));
  const rankBy = new Map<string, number>();
  order.forEach((r, i) => {
    if (i < TOP_N && r.publicUsd > 0) rankBy.set(r.slug, i + 1);
  });
  const sponsorships = rows.reduce((n, r) => n + r.links, 0);
  const index = rows.map(({ links: _links, ...r }) => ({ ...r, rank: rankBy.get(r.slug) ?? null }));
  const publicUsdAll = round2(index.reduce((s, r) => s + r.publicUsd, 0));
  const publicUsdRanked = round2(index.filter((r) => r.rank != null).reduce((s, r) => s + r.publicUsd, 0));
  return {
    meta: {
      collectedAt: w.week,
      hash: w.fingerprint,
      companies: index.length,
      // Company→collective and company→GitHub beneficiary links in the week.
      sponsorships,
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

/**
 * Convert both weeks with the SAME identity and the SAME filter, as the
 * scraper diff behind /api/movements does:
 * - identity: previous-week slugs are mapped to their current slug through the
 *   catalog renames (slug-renames.json, passed as `canonical`) and the stable-ID
 *   renames the scraper recorded in the current week (diff.renamed);
 * - filter: union of both weeks' blocked sets (hold, exclusionNote,
 *   excludedNoted, diff.held), every slug form included, plus the global
 *   hidden lists. A row held in one week can never surface as new or gone.
 */
export function pairToSnaps(
  prev: ParsedWeekly,
  curr: ParsedWeekly,
  hidden: (slug: string) => boolean = () => false,
  canonical: (slug: string) => string = (s) => s,
): { prev: SnapFile; curr: SnapFile } {
  const toCurr = (slug: string) => {
    const s = slug.toLowerCase();
    return curr.renamed.get(s) ?? canonical(s);
  };
  const blocked = new Set<string>();
  for (const s of [...prev.blocked, ...curr.blocked]) {
    blocked.add(s);
    blocked.add(toCurr(s));
  }
  const filter = (slug: string) => blocked.has(slug) || blocked.has(toCurr(slug)) || hidden(slug) || hidden(toCurr(slug));
  return { prev: weeklyToSnap(prev, filter, toCurr), curr: weeklyToSnap(curr, filter, canonical) };
}

/**
 * The /movements diff, shared by the page and /api/v1/deltas. New and gone
 * companies are restricted to what the scraper diff recorded for the current
 * week (the source of /api/movements), so the page never contradicts the API.
 */
export function buildWeeklyMovements(
  prevW: ParsedWeekly,
  currW: ParsedWeekly,
  meta: Meta,
  hidden: (slug: string) => boolean = () => false,
  canonical: (slug: string) => string = (s) => s,
): MovementsPayload {
  const { prev, curr } = pairToSnaps(prevW, currW, hidden, canonical);
  const move = buildMovementsFromSnaps(prev, curr, meta);
  const newSet = new Set(currW.newSlugs.map(canonical));
  const goneSet = new Set(currW.goneSlugs.map(canonical));
  const newCompanies = move.newCompanies.filter((r) => newSet.has(r.slug));
  const leftCompanies = move.leftCompanies.filter((r) => goneSet.has(r.slug));
  return {
    ...move,
    newCompanies,
    leftCompanies,
    summary: { ...move.summary, newCompanies: newCompanies.length, leftCompanies: leftCompanies.length },
    insufficient: false,
  };
}

export const SNAPSHOTS_CSV_HEADER = [
  "collected_at",
  "hash",
  "companies",
  "sponsorships",
  "ranked",
  "public_usd_ranked",
  "public_usd_all",
] as const;

/** Snapshots CSV, oldest week first; invalid or off-cycle weeks are left out. */
export async function buildSnapshotsCsv(
  weeks: Iterable<string>,
  load: (week: string) => Promise<unknown>,
  hidden: (slug: string) => boolean = () => false,
  canonical: (slug: string) => string = (s) => s,
): Promise<string> {
  const lines: string[] = [SNAPSHOTS_CSV_HEADER.join(",")];
  for (const week of [...new Set(weeks)].filter(isRealWeek).sort()) {
    let raw: unknown;
    try {
      raw = await load(week);
    } catch {
      continue;
    }
    const parsed = parseWeekly(week, raw);
    if (!parsed) continue;
    const m = weeklyToSnap(parsed, hidden, canonical).meta;
    lines.push(
      [m.collectedAt, m.hash, m.companies, m.sponsorships, m.ranked, m.publicUsdRanked, m.publicUsdAll]
        .map((v) => {
          const t = String(v);
          return /[",\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
        })
        .join(","),
    );
  }
  return lines.join("\n");
}
