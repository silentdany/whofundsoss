import { isSpamDenylisted } from "./spam-denylist";
import holdsCsv from "../../data/holds/weekly-holds.csv?raw";
import { activeHolds, parseHolds, todayUtc, withoutHeld } from "./holds";
import raw from "@/data/catalog.json";
// Catalog dumps: still used by the snapshots CSV export only.
import snapPrev from "@/data/snapshots/2026-10-05.json";
import snapCurr from "@/data/snapshots/2026-10-06.json";
import { money } from "@/lib/format";
import { buildMovementsFromSnaps, type SnapFile } from "@/lib/movements";
import { buildWeeklyMovements, selectLatestTwo, weeklyToSnap } from "@/lib/weekly-snapshots";
import { normSlug, SLUG_RENAMES, slugEquivalents } from "@/lib/slug-aliases";
import { formatSponsorshipProjectLabel } from "@/lib/sponsorship-url";
import {
  buildProjectIndex,
  companyLinkedProjects,
  companyNarrativeLead,
  gatedProjects,
  isProjectPublished,
  type ProjectRecord,
} from "@/lib/projects";
import type {
  Alliance,
  BySource,
  Commons,
  CompanyRow,
  Meta,
  MovementsPayload,
  SourceKey,
  Sponsorship,
  WatchItem,
} from "@/lib/types";

type CatalogFile = {
  meta: Meta;
  index: CompanyRow[];
  details: Record<string, { bySource: BySource; sponsorships: Sponsorship[] }>;
  alliances: Alliance[];
  commons: Commons[];
  watchlist: { slug: string; reason: string; added: string }[];
};

const rawCatalog = raw as CatalogFile;
const holds = parseHolds(holdsCsv);

/**
 * Per-day view of the catalog. Companies on an active weekly hold
 * (data/holds/weekly-holds.csv, until review_on) are removed everywhere on the
 * site: company page (404), ranking, search, graph, projects, sitemap, exports.
 * Same rule as the public API.
 */
function buildView(today: string) {
  const held = activeHolds(holds, today);
  const catalog = withoutHeld(rawCatalog, held);
  const bySlug = new Map(catalog.index.map((row) => [row.slug, row]));
  /** Rows shown in rankings and lists. Spam-denylisted companies keep a page but are never listed. */
  const listedRows = catalog.index.filter((row) => !isSpamDenylisted(row.slug));
  const projectIndex = buildProjectIndex(catalog.index, catalog.details);
  const publishedProjects = gatedProjects(projectIndex);
  const publishedProjectSlugs = new Set(publishedProjects.map((p) => p.slug));
  return { today, held, catalog, bySlug, listedRows, projectIndex, publishedProjects, publishedProjectSlugs };
}
let view: ReturnType<typeof buildView> | null = null;
function V() {
  const today = todayUtc();
  if (!view || view.today !== today) view = buildView(today);
  return view;
}

/** Slugs on an active hold today (for snapshot-based movements). */
export function heldSlugsToday(): ReadonlySet<string> {
  return V().held;
}

export function getMeta(): Meta {
  // Soft Sécu: never dehydrate process notes (e.g. note_triage) into SSR.
  const { note_triage: _drop, ...meta } = V().catalog.meta as Meta & { note_triage?: string };
  void _drop;
  return meta;
}

/** Whether the catalog has a company under this exact key (rename redirects). */
export function hasCompany(slug: string): boolean {
  return getRow(slug) !== null;
}

export function getRow(slug: string): CompanyRow | null {
  return V().bySlug.get(slug) ?? null;
}

export function homePayload() {
  const posit = V().bySlug.get("posit-dev");
  const sentry = V().bySlug.get("getsentry");
  const microsoft = V().bySlug.get("microsoft");
  const positDetail = V().catalog.details["posit-dev"];
  const ghosts = V().catalog.index
    .filter((row) => row.unitemized)
    .slice(0, 4);

  const brief: {
    href: "company" | "mysteries";
    slug: string | null;
    title: string;
    text: string;
  }[] = [];
  if (posit && positDetail) {
    brief.push({
      href: "company" as const,
      slug: posit.slug,
      title: posit.name,
      text: `Leads the ranking at ${money(posit.publicUsd)} in public funding. ${money(positDetail.bySource.osp)} of that is its 2025 Open Source Pledge; ${money(positDetail.bySource.oc)} is cumulative Open Collective giving, not a yearly figure.`,
    });
  }
  if (sentry) {
    brief.push({
      href: "company" as const,
      slug: sentry.slug,
      title: sentry.name,
      text: `${money(sentry.publicUsd)} through the Open Source Pledge, and it sponsors ${sentry.ghBeneficiaries} maintainers on GitHub without publishing any amounts. The pledge is not counted a second time.`,
    });
  }
  if (ghosts.length) {
    brief.push({
      href: "mysteries" as const,
      slug: null,
      title: "Money declared, no project named",
      text: `${ghosts.map((row) => row.name).join(", ")} publish pledge dollars but name no project.`,
    });
  }
  if (microsoft) {
    brief.push({
      href: "company" as const,
      slug: microsoft.slug,
      title: microsoft.name,
      text: `The public total is only ${money(microsoft.publicUsd)}: a cumulative gift to webpack. Big companies can fund a lot privately, so a low number here is a floor, not a verdict.`,
    });
  }

  const mix = (["oc", "osp", "gh", "own"] as SourceKey[]).map((key) => ({
    key,
    companies: V().catalog.index.filter((row) => row.sources.includes(key)).length,
  }));

  return {
    meta: getMeta(),
    brief,
    top: V().catalog.index.filter((row) => row.rank && row.rank <= 10).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)),
    mix,
  };
}

export function rankingPayload() {
  return { meta: getMeta(), rows: V().listedRows };
}

export function companyPayload(slug: string) {
  const row = V().bySlug.get(slug);
  const rawDetail = V().catalog.details[slug];
  if (!row || !rawDetail) return null;
  const linkedProjects = companyLinkedProjects(rawDetail, V().publishedProjectSlugs);
  const narrative = companyNarrativeLead(row, rawDetail, money);
  // Soft Copy: EN labels, no em dash in dehydrated UI payload.
  const detail = {
    ...rawDetail,
    sponsorships: rawDetail.sponsorships.map((item) => ({
      ...item,
      project: formatSponsorshipProjectLabel(item.project),
    })),
  };
  return { row, detail, meta: getMeta(), linkedProjects, narrative };
}

export function projectPayload(slug: string): { project: ProjectRecord; meta: ReturnType<typeof getMeta> } | null {
  const key = slug.trim().toLowerCase();
  const project = V().projectIndex.get(key);
  if (!isProjectPublished(project)) return null;
  return { project: project!, meta: getMeta() };
}

export function listPublishedProjects(): ProjectRecord[] {
  return V().publishedProjects;
}

export function publishedProjectPathList(): string[] {
  return V().publishedProjects.map((p) => `/project/${encodeURIComponent(p.slug)}`);
}

/**
 * Diff of the two latest weekly snapshots in data/weekly (same listing as the
 * public API). The files are bundled at build time, so every deploy triggered
 * by a weekly-snapshot commit picks up the new week; no dates are hardcoded.
 */
export async function movementsPayload(): Promise<MovementsPayload> {
  const { WEEKS, loadWeek, api } = await import("@/lib/public-api/data.server");
  const held = V().held;
  const hidden = (slug: string) => slugEquivalents(slug).some((s) => held.has(s) || api.hidden(s));
  const canonical = (slug: string) => SLUG_RENAMES.get(normSlug(slug)) ?? normSlug(slug);
  const pair = await selectLatestTwo(WEEKS, (week) => loadWeek(week));
  if (pair.skipped.length) {
    console.warn(`[movements] skipped invalid weekly snapshot(s): ${pair.skipped.join(", ")}`);
  }
  const used = pair.status === "ok" ? [pair.prev, pair.curr] : pair.only ? [pair.only] : [];
  for (const w of used) for (const msg of w.warnings) console.warn(`[movements] ${msg}`);
  if (pair.status === "ok") return buildWeeklyMovements(pair.prev, pair.curr, getMeta(), hidden, canonical);
  const only: SnapFile = pair.only
    ? weeklyToSnap(pair.only, hidden, canonical)
    : {
        meta: {
          collectedAt: getMeta().collectedAt,
          hash: "none",
          companies: 0,
          sponsorships: 0,
          ranked: 0,
          publicUsdAll: 0,
          publicUsdRanked: 0,
        },
        index: [],
      };
  return { ...buildMovementsFromSnaps(only, only, getMeta()), insufficient: true };
}

export function mysteriesPayload() {
  const unitemized = V().listedRows.filter((row) => row.unitemized);
  const unpriced = V().listedRows
    .filter((row) => {
      const detail = V().catalog.details[row.slug];
      return (
        row.sources.includes("gh") &&
        row.ghBeneficiaries >= 8 &&
        (detail?.bySource.gh ?? 0) === 0
      );
    })
    .sort((a, b) => b.ghBeneficiaries - a.ghBeneficiaries)
    .slice(0, 12);
  return { meta: getMeta(), unitemized, unpriced };
}

export function graphPayload() {
  const ids = new Set<string>();
  for (const link of V().catalog.alliances) {
    ids.add(link.a);
    ids.add(link.b);
  }
  const nodes = V().catalog.index
    .filter((row) => ids.has(row.slug))
    .map((row) => ({
      id: row.slug,
      name: row.name,
      publicUsd: row.publicUsd,
      rank: row.rank,
    }));
  return {
    meta: getMeta(),
    nodes,
    links: V().catalog.alliances,
    commons: V().catalog.commons,
    publishedProjectSlugs: [...V().publishedProjectSlugs],
  };
}

export function watchlistPayload() {
  const items: WatchItem[] = V().catalog.watchlist.map((item) => ({
    ...item,
    row: V().bySlug.get(item.slug) ?? null,
  }));
  const picker = V().listedRows.map((row) => ({
    slug: row.slug,
    name: row.name,
    rank: row.rank,
    publicUsd: row.publicUsd,
    projects: row.projects,
  }));
  return { meta: getMeta(), items, picker };
}

export function leaderboardQuery(params: URLSearchParams) {
  const sort = params.get("sort") === "projects" ? "projects" : params.get("sort") === "gh" ? "gh" : "public_usd";
  const limit = clampInt(params.get("limit"), 50, 1, 200);
  const offset = clampInt(params.get("offset"), 0, 0, 10_000);
  const includeWhales = params.get("include_whales") !== "false";
  const source = params.get("source");
  let rows = V().listedRows.slice();
  if (!includeWhales) rows = rows.filter((row) => !row.whale);
  if (source === "oc" || source === "osp" || source === "gh" || source === "own") {
    rows = rows.filter((row) => row.sources.includes(source));
  }
  rows.sort((a, b) => {
    if (sort === "projects") return b.projects - a.projects || b.publicUsd - a.publicUsd;
    if (sort === "gh") return b.ghBeneficiaries - a.ghBeneficiaries || b.publicUsd - a.publicUsd;
    return b.publicUsd - a.publicUsd;
  });
  const page = rows.slice(offset, offset + limit);
  return {
    collected_at: V().catalog.meta.collectedAt,
    sort,
    total: rows.length,
    limit,
    offset,
    include_whales: includeWhales,
    entries: page.map((row) => ({
      rank: row.rank,
      delta_rank: null,
      slug: row.slug,
      name: row.name,
      projects: row.projects,
      public_usd: row.publicUsd,
      gh_beneficiaries: row.ghBeneficiaries,
      sources: row.sources,
      transparency_score: row.transparency,
      whale: row.whale,
    })),
  };
}

export function companyApi(slug: string) {
  const payload = companyPayload(slug);
  if (!payload) return null;
  const { row, detail, meta } = payload;
  const flags = [
    ...(row.whale ? ["whale"] : []),
    ...(row.unitemized ? ["unitemized"] : []),
    ...(row.dedupedPledge ? ["pledge_not_double_counted"] : []),
    ...(row.lowVolume ? ["low_volume"] : []),
  ];
  return {
    slug: row.slug,
    name: row.name,
    website: row.site,
    sector: row.sector,
    flags,
    rank: row.rank,
    delta_rank: null,
    totals: {
      public_usd: row.publicUsd,
      projects: row.projects,
      gh_beneficiaries: row.ghBeneficiaries,
      by_source: detail.bySource,
    },
    transparency_score: row.transparency,
    transparency: {
      score: row.transparency,
      volume: row.volume,
      coverage: row.coverage,
      projects_with_amount: row.projectsWithAmount,
      projects_total: row.projects,
      low_volume: row.lowVolume,
      note: "Score = 0.6 × (public $ / leader) + 0.4 × (sponsorships with a public amount / sponsorships). Read it next to the total.",
    },
    sponsorships: detail.sponsorships.map((item) => ({
      project: item.project,
      source: item.source,
      amount_usd: item.amountUsd,
      cumulative: item.cumulative,
      visibility: item.visibility,
      aggregate: item.aggregate,
      collected_at: meta.collectedAt,
    })),
    last_collected_at: meta.collectedAt,
  };
}

export function sponsorshipsQuery(slug: string, params: URLSearchParams) {
  const detail = V().catalog.details[slug];
  const row = V().bySlug.get(slug);
  if (!detail || !row) return null;
  const source = params.get("source");
  let items = detail.sponsorships;
  if (source === "oc" || source === "osp" || source === "gh" || source === "own") {
    items = items.filter((item) => item.source === source);
  }
  const perPage = clampInt(params.get("per_page"), 50, 1, 200);
  const page = clampInt(params.get("page"), 1, 1, 10_000);
  const start = (page - 1) * perPage;
  return {
    slug,
    name: row.name,
    page,
    per_page: perPage,
    total: items.length,
    sponsorships: items.slice(start, start + perPage).map((item) => ({
      project: item.project,
      source: item.source,
      amount_usd: item.amountUsd,
      cumulative: item.cumulative,
      visibility: item.visibility,
      collected_at: V().catalog.meta.collectedAt,
    })),
  };
}

export async function deltasPayload(params: URLSearchParams) {
  const move = await movementsPayload();
  const from = params.get("from") ?? move.from.collectedAt;
  const to = params.get("to") ?? move.to.collectedAt;
  const companies = [...move.climbers, ...move.fallers]
    .filter((row) => row.deltaRank != null && Math.abs(row.deltaRank) > 5)
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      rank: row.rank,
      previous_rank: row.previousRank,
      delta_rank: row.deltaRank,
      public_usd: row.publicUsd,
      previous_public_usd: row.previousPublicUsd,
      delta_usd: row.deltaUsd,
    }));
  return {
    from,
    to,
    companies,
    summary: {
      risers: move.summary.climbers,
      fallers: move.summary.fallers,
      new_entrants: move.summary.newCompanies,
      exits: move.summary.leftCompanies,
    },
    notable_rule: "A rank move of more than 5 positions is notable.",
    note: move.note,
    hashes: { from: move.from.hash, to: move.to.hash },
  };
}

export function graphQuery(params: URLSearchParams) {
  const minShared = clampInt(params.get("min_shared"), 2, 2, 50);
  const limit = clampInt(params.get("limit"), 50, 1, 80);
  const pairs = V().catalog.alliances
    .filter((link) => link.shared >= minShared)
    .slice(0, limit)
    .map((link) => ({
      a: link.a,
      b: link.b,
      shared_projects: link.shared,
      projects: link.projects,
    }));
  return {
    collected_at: V().catalog.meta.collectedAt,
    min_shared: minShared,
    note: "Pairs that share distinctive projects (2–15 sponsors). Mega-collectives such as webpack are listed separately so the graph is not a hairball.",
    pairs,
  };
}

export function watchlistApi() {
  return {
    collected_at: V().catalog.meta.collectedAt,
    companies: V().catalog.watchlist.map((item) => {
      const row = V().bySlug.get(item.slug);
      return {
        slug: item.slug,
        reason: item.reason,
        added: item.added,
        rank: row?.rank ?? null,
        delta_rank: null,
        public_usd: row?.publicUsd ?? null,
        projects: row?.projects ?? null,
        name: row?.name ?? null,
      };
    }),
  };
}

export function alertsPayload(params: URLSearchParams) {
  return {
    since: params.get("since"),
    collected_at: V().catalog.meta.collectedAt,
    alerts: [],
    note: "Compare /movements for the 2026-10-05 → 2026-10-06 V().catalog delta.",
  };
}

export function companiesCsv(): string {
  const header = [
    "rank",
    "slug",
    "name",
    "public_usd",
    "projects",
    "gh_beneficiaries",
    "sources",
    "transparency_score",
    "whale",
    "unitemized",
    "website",
    "spam_denylisted",
  ];
  const lines = V().catalog.index.map((row) =>
    [
      row.rank ?? "",
      row.slug,
      row.name,
      row.publicUsd,
      row.projects,
      row.ghBeneficiaries,
      row.sources.join("|"),
      row.transparency,
      row.whale,
      row.unitemized,
      row.site ?? "",
      isSpamDenylisted(row.slug),
    ].map(csvCell),
  );
  return [header.join(","), ...lines.map((line) => line.join(","))].join("\n");
}

export function sponsorshipsCsv(): string {
  const header = ["slug", "company", "project", "source", "amount_usd", "cumulative", "visibility", "collected_at"];
  const lines: string[] = [];
  for (const row of V().catalog.index) {
    const detail = V().catalog.details[row.slug];
    if (!detail) continue;
    for (const item of detail.sponsorships) {
      lines.push(
        [
          row.slug,
          row.name,
          item.project,
          item.source,
          item.amountUsd ?? "",
          item.cumulative,
          item.visibility,
          V().catalog.meta.collectedAt,
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }
  return [header.join(","), ...lines].join("\n");
}

export function snapshotsCsv(): string {
  const header = ["collected_at", "hash", "companies", "sponsorships", "ranked", "public_usd_ranked", "public_usd_all"];
  const prev = snapPrev as SnapFile;
  const curr = snapCurr as SnapFile;
  const rows = [prev.meta, curr.meta].map((m) =>
    [
      m.collectedAt,
      m.hash,
      m.companies,
      m.sponsorships,
      m.ranked,
      m.publicUsdRanked,
      m.publicUsdAll,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = raw == null ? fallback : Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Sitemap paths from the catalog (see `sitemapPaths` in indexing.ts). */
export function catalogSitemapPaths(
  build: (rows: CompanyRow[], details: CatalogFile["details"], projectPaths?: string[]) => string[],
): string[] {
  return build(V().catalog.index, V().catalog.details, publishedProjectPathList());
}

export type SearchHit = { slug: string; name: string; rank: number | null; publicUsd: number };

/** Name search for the company picker. Spam-denylisted pages are never suggested. */
export function searchCompanies(query: string, limit = 6): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return V().catalog.index
    .filter((row) => !isSpamDenylisted(row.slug) && (row.name.toLowerCase().includes(q) || row.slug.includes(q)))
    .sort((a, b) => {
      const as = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bs = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return as - bs || b.publicUsd - a.publicUsd;
    })
    .slice(0, limit)
    .map((row) => ({ slug: row.slug, name: row.name, rank: row.rank, publicUsd: row.publicUsd }));
}
