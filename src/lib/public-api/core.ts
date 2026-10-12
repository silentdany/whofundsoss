/**
 * Public read-only API v1 (/api/*). Pure module: no Vite or Node imports, so it
 * is unit-tested with `node --experimental-strip-types`. The server wiring that
 * feeds it the real snapshot lives in `./data.server.ts`.
 *
 * Never exposed, whatever the route:
 * - private GitHub amounts (always `amount_usd: null` with `private: true`);
 * - companies on a weekly hold (data/holds/weekly-holds.csv, or a record
 *   carried forward with a `hold` tag);
 * - companies in the raw exclusions (data/exclusions/raw-exclusions.csv);
 * - spam: the spam denylist, plus any weekly row the scraper tagged
 *   `exclusionNote`.
 */
import type { BySource, CompanyRow, SourceKey, Sponsorship } from "../types.ts";

export const API_VERSION = "v1";

export const SOURCE_NAMES: Record<SourceKey, string> = {
  gh: "GitHub Sponsors",
  oc: "Open Collective",
  osp: "Open Source Pledge",
  own: "Own program",
};

export type CatalogLike = {
  meta: { collectedAt: string; hash: string };
  index: CompanyRow[];
  details: Record<string, { bySource: BySource; sponsorships: Sponsorship[] } | undefined>;
};

export type WeeklyCompany = {
  slug: string;
  name?: string | null;
  sources?: string[];
  hold?: unknown;
  exclusionNote?: string | null;
};

export type WeeklyFile = {
  date: string;
  denylist?: { version?: string };
  companies?: WeeklyCompany[];
  excludedNoted?: { slug?: string | null }[];
  diff?: Record<string, unknown>;
};

export type ApiInput = {
  catalog: CatalogLike;
  denylistVersion: string;
  /** Slugs on the spam denylist. */
  spam: ReadonlySet<string>;
  /** Slugs in the raw exclusions (by GitHub login or exact name, see data.server.ts). */
  excluded: ReadonlySet<string>;
  /** Slugs on an active or past weekly hold. */
  held: ReadonlySet<string>;
  /** Public denylist export (src/data/public-spam-denylist.json). */
  publicDenylist: unknown;
};

export type ApiResult = { status: number; body: unknown };

const SOURCE_KEYS: SourceKey[] = ["gh", "oc", "osp", "own"];
const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/;

export function createPublicApi(input: ApiInput) {
  const { catalog } = input;
  const hidden = (slug: string) =>
    input.spam.has(slug) || input.excluded.has(slug) || input.held.has(slug);
  const visibleRows = catalog.index.filter((row) => !hidden(row.slug));
  const rowBySlug = new Map(visibleRows.map((row) => [row.slug, row]));

  function meta(sources: Iterable<SourceKey | string>, extra: Record<string, unknown> = {}) {
    const keys = [...new Set(sources)].filter((s): s is SourceKey => (SOURCE_KEYS as string[]).includes(s));
    keys.sort((a, b) => SOURCE_KEYS.indexOf(a) - SOURCE_KEYS.indexOf(b));
    return {
      api_version: API_VERSION,
      snapshot_date: catalog.meta.collectedAt,
      snapshot_hash: catalog.meta.hash,
      denylist_version: input.denylistVersion,
      sources: keys.map((key) => ({ key, name: SOURCE_NAMES[key] })),
      ...extra,
    };
  }

  function amount(item: Pick<Sponsorship, "source" | "amountUsd" | "visibility">) {
    const isPrivate = item.visibility !== "public" || item.amountUsd == null;
    return isPrivate
      ? { amount_usd: null, private: true as const }
      : { amount_usd: item.amountUsd, private: false as const };
  }

  function bySource(row: CompanyRow, detail: { bySource: BySource; sponsorships: Sponsorship[] } | undefined) {
    const out: Record<string, { source: string; amount_usd: number | null; private: boolean }> = {};
    for (const key of row.sources) {
      const items = (detail?.sponsorships ?? []).filter((s) => s.source === key);
      const anyPublic = items.some((s) => s.visibility === "public" && s.amountUsd != null);
      const value = detail?.bySource[key] ?? 0;
      out[key] = anyPublic
        ? { source: SOURCE_NAMES[key], amount_usd: value, private: false }
        : { source: SOURCE_NAMES[key], amount_usd: null, private: true };
    }
    return out;
  }

  /** Named projects, recomputed from visible companies only (gate: 3 companies). */
  type ProjectAgg = {
    slug: string;
    name: string;
    sponsors: { slug: string; name: string; rank: number | null; item: Sponsorship }[];
  };
  const projects = new Map<string, ProjectAgg>();
  for (const row of visibleRows) {
    const detail = catalog.details[row.slug];
    if (!detail) continue;
    const best = new Map<string, Sponsorship>();
    for (const item of detail.sponsorships) {
      if (item.aggregate) continue;
      const slug = item.project.trim().toLowerCase();
      if (!SLUG_RE.test(slug) || slug.startsWith("(")) continue;
      const prev = best.get(slug);
      if (!prev || (item.amountUsd ?? -1) > (prev.amountUsd ?? -1)) best.set(slug, item);
    }
    for (const [slug, item] of best) {
      let rec = projects.get(slug);
      if (!rec) {
        rec = { slug, name: item.project.trim(), sponsors: [] };
        projects.set(slug, rec);
      }
      rec.sponsors.push({ slug: row.slug, name: row.name, rank: row.rank, item });
    }
  }
  const publishedProjects = [...projects.values()]
    .filter((p) => p.sponsors.length >= 3)
    .sort((a, b) => b.sponsors.length - a.sponsors.length || a.slug.localeCompare(b.slug));

  function projectSummary(p: ProjectAgg) {
    const sources = new Set(p.sponsors.map((s) => s.item.source));
    return {
      slug: p.slug,
      name: p.name,
      sponsor_count: p.sponsors.length,
      public_usd: round2(p.sponsors.reduce((sum, s) => sum + (amount(s.item).amount_usd ?? 0), 0)),
      private_sponsorships: p.sponsors.filter((s) => amount(s.item).private).length,
      sources: [...sources].map((key) => ({ key, name: SOURCE_NAMES[key] })),
    };
  }

  function listProjects(params: URLSearchParams): ApiResult {
    const perPage = clampInt(params.get("per_page"), 50, 1, 100);
    const page = clampInt(params.get("page"), 1, 1, 10_000);
    const source = params.get("source");
    const q = (params.get("q") ?? "").trim().toLowerCase();
    const sponsor = (params.get("sponsor") ?? "").trim().toLowerCase();
    const minSponsors = clampInt(params.get("min_sponsors"), 3, 3, 10_000);
    if (source && !(SOURCE_KEYS as string[]).includes(source)) {
      return error(400, "source must be one of gh, oc, osp, own.");
    }
    let rows = publishedProjects.filter((p) => p.sponsors.length >= minSponsors);
    if (source) rows = rows.filter((p) => p.sponsors.some((s) => s.item.source === source));
    if (q) rows = rows.filter((p) => p.slug.includes(q) || p.name.toLowerCase().includes(q));
    if (sponsor) rows = rows.filter((p) => p.sponsors.some((s) => s.slug === sponsor));
    const start = (page - 1) * perPage;
    const data = rows.slice(start, start + perPage).map(projectSummary);
    return ok({
      meta: meta(data.flatMap((p) => p.sources.map((s) => s.key))),
      pagination: {
        page,
        per_page: perPage,
        total: rows.length,
        total_pages: Math.max(1, Math.ceil(rows.length / perPage)),
      },
      filters: { source: source ?? null, q: q || null, sponsor: sponsor || null, min_sponsors: minSponsors },
      data,
    });
  }

  function getProject(slugRaw: string): ApiResult {
    const slug = slugRaw.trim().toLowerCase();
    const p = projects.get(slug);
    if (!p || p.sponsors.length < 3) return error(404, "Project not found.");
    const sponsors = [...p.sponsors]
      .sort((a, b) => (b.item.amountUsd ?? -1) - (a.item.amountUsd ?? -1) || a.name.localeCompare(b.name))
      .map((s) => ({
        slug: s.slug,
        name: s.name,
        rank: s.rank,
        source: s.item.source,
        source_name: SOURCE_NAMES[s.item.source],
        cumulative: s.item.cumulative,
        ...amount(s.item),
      }));
    return ok({ meta: meta(sponsors.map((s) => s.source)), data: { ...projectSummary(p), sponsors } });
  }

  function getSponsor(slugRaw: string): ApiResult {
    const slug = slugRaw.trim().toLowerCase();
    const row = rowBySlug.get(slug);
    const detail = row ? catalog.details[row.slug] : undefined;
    if (!row || !detail) return error(404, "Sponsor not found.");
    const sponsorships = detail.sponsorships.map((item) => ({
      project: item.aggregate ? null : item.project.trim(),
      aggregate: item.aggregate,
      label: item.aggregate ? item.project.trim() : null,
      source: item.source,
      source_name: SOURCE_NAMES[item.source],
      cumulative: item.cumulative,
      ...amount(item),
    }));
    return ok({
      meta: meta(row.sources),
      data: {
        slug: row.slug,
        name: row.name,
        website: row.site,
        sector: row.sector,
        rank: row.rank,
        public_usd: row.publicUsd,
        gh_beneficiaries: row.ghBeneficiaries,
        by_source: bySource(row, detail),
        sponsorships,
      },
    });
  }

  function movements(week: string | null, weekly: WeeklyFile | null, weeks: string[]): ApiResult {
    if (!week || !WEEK_RE.test(week)) return error(400, "Pass week=YYYY-MM-DD.", { available_weeks: weeks });
    if (!weekly) return error(404, `No weekly snapshot for ${week}.`, { available_weeks: weeks });
    const blocked = new Set<string>();
    for (const c of weekly.companies ?? []) {
      if (c.hold || c.exclusionNote) blocked.add(String(c.slug).toLowerCase());
    }
    for (const e of weekly.excludedNoted ?? []) if (e.slug) blocked.add(String(e.slug).toLowerCase());
    for (const h of asRows(weekly.diff?.held)) if (h.slug) blocked.add(String(h.slug).toLowerCase());
    const allowed = (slug: unknown) => {
      const s = String(slug ?? "").toLowerCase();
      return !!s && !blocked.has(s) && !hidden(s);
    };
    const usedSources = new Set<string>();
    const srcs = (r: Record<string, unknown>) => {
      const list = (Array.isArray(r.sources) ? r.sources : r.source ? [r.source] : []) as string[];
      list.forEach((s) => usedSources.add(s));
      return list.map((key) => ({ key, name: SOURCE_NAMES[key as SourceKey] ?? key }));
    };
    const usd = (v: unknown) => (typeof v === "number" ? v : null);
    const d = weekly.diff ?? {};
    const data = {
      week: weekly.date,
      new_sponsors: asRows(d.new_sponsors)
        .filter((r) => allowed(r.slug))
        .map((r) => ({ slug: r.slug, name: r.name ?? null, sources: srcs(r), public_usd: usd(r.publicUsd) })),
      disappeared_sponsors: asRows(d.disappeared_sponsors)
        .filter((r) => allowed(r.slug))
        .map((r) => ({ slug: r.slug, name: r.name ?? null, sources: srcs(r), last_public_usd: usd(r.publicUsd) })),
      amount_changes: asRows(d.amount_changes)
        .filter((r) => allowed(r.slug) && r.source !== "gh")
        .map((r) => ({
          slug: r.slug,
          name: r.name ?? null,
          source: srcs(r)[0] ?? null,
          from_usd: usd(r.from),
          to_usd: usd(r.to),
          delta_usd: usd(r.delta),
        })),
      new_sponsorships: asRows(d.new_sponsorships)
        .filter((r) => allowed(r.sponsor))
        .map((r) => {
          usedSources.add("gh");
          return { sponsor: r.sponsor, beneficiary: r.beneficiary, source: { key: "gh", name: SOURCE_NAMES.gh }, amount_usd: null, private: true };
        }),
      beneficiary_changes: asRows(d.beneficiary_changes)
        .filter((r) => allowed(r.slug))
        .map((r) => {
          usedSources.add("gh");
          return { slug: r.slug, name: r.name ?? null, source: { key: "gh", name: SOURCE_NAMES.gh }, from: r.from, to: r.to };
        }),
      renamed: asRows(d.renamed)
        .filter((r) => allowed(r.from) && allowed(r.to))
        .map((r) => ({ from: r.from, to: r.to, name: r.name ?? null })),
    };
    return ok({
      meta: meta(usedSources, {
        week: weekly.date,
        weekly_denylist_version: weekly.denylist?.version ?? null,
        available_weeks: weeks,
      }),
      data,
    });
  }

  function denylist(): ApiResult {
    return ok({ meta: meta([]), data: input.publicDenylist });
  }

  return { listProjects, getProject, getSponsor, movements, denylist, hidden };
}

function asRows(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : [];
}

function ok(body: unknown): ApiResult {
  return { status: 200, body };
}

function error(status: number, message: string, extra: Record<string, unknown> = {}): ApiResult {
  return { status, body: { error: { status, message }, ...extra } };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = raw == null || raw === "" ? fallback : Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Parse raw-exclusions.csv into slugs (GitHub login, lowercased). */
export function exclusionSlugs(csvText: string, catalogRows: Pick<CompanyRow, "slug" | "name">[]): Set<string> {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines.shift() ?? "");
  const iLogin = header.indexOf("login_github");
  const iName = header.indexOf("entreprise");
  const names = new Map(catalogRows.map((r) => [r.name.trim().toLowerCase(), r.slug]));
  const out = new Set<string>();
  for (const line of lines) {
    const cells = parseCsvLine(line);
    const login = (cells[iLogin] ?? "").trim().toLowerCase();
    if (login) out.add(login);
    const byName = names.get((cells[iName] ?? "").trim().toLowerCase());
    if (byName) out.add(byName);
  }
  return out;
}

/** Parse data/holds/weekly-holds.csv into slugs. */
export function holdSlugs(csvText: string): Set<string> {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines.shift() ?? "");
  const i = header.indexOf("slug");
  return new Set(lines.map((l) => (parseCsvLine(l)[i] ?? "").trim().toLowerCase()).filter(Boolean));
}

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
