import raw from "@/data/catalog.json";
import { money } from "@/lib/format";
import type {
  Alliance,
  BySource,
  Commons,
  CompanyRow,
  Meta,
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

const catalog = raw as CatalogFile;

const bySlug = new Map(catalog.index.map((row) => [row.slug, row]));

export function getMeta(): Meta {
  return catalog.meta;
}

export function getRow(slug: string): CompanyRow | null {
  return bySlug.get(slug) ?? null;
}

export function homePayload() {
  const posit = bySlug.get("posit-dev");
  const sentry = bySlug.get("getsentry");
  const microsoft = bySlug.get("microsoft");
  const positDetail = catalog.details["posit-dev"];
  const ghosts = catalog.index
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
      text: `Leads the public record at ${money(posit.publicUsd)}. ${money(positDetail.bySource.osp)} of that is the 2025 pledge. ${money(positDetail.bySource.oc)} is cumulative Open Collective, not a yearly run-rate.`,
    });
  }
  if (sentry) {
    brief.push({
      href: "company" as const,
      slug: sentry.slug,
      title: sentry.name,
      text: `${money(sentry.publicUsd)} through the Open Source Pledge, and ${sentry.ghBeneficiaries} GitHub beneficiaries. None of those tiers publish an amount. The pledge is not counted a second time.`,
    });
  }
  if (ghosts.length) {
    brief.push({
      href: "mysteries" as const,
      slug: null,
      title: "Named nowhere",
      text: `${ghosts.map((row) => row.name).join(", ")} publish pledge dollars and name zero projects.`,
    });
  }
  if (microsoft) {
    brief.push({
      href: "company" as const,
      slug: microsoft.slug,
      title: microsoft.name,
      text: `The public total is ${money(microsoft.publicUsd)}, a cumulative gift to webpack. The score sits next to that number on purpose. Alone, it lies.`,
    });
  }

  const mix = (["oc", "osp", "gh", "own"] as SourceKey[]).map((key) => ({
    key,
    companies: catalog.index.filter((row) => row.sources.includes(key)).length,
  }));

  return {
    meta: catalog.meta,
    brief,
    top: catalog.index.filter((row) => row.rank && row.rank <= 10).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)),
    featured: bySlug.get(catalog.meta.featuredSlug) ?? null,
    mix,
  };
}

export function rankingPayload() {
  return { meta: catalog.meta, rows: catalog.index };
}

export function companyPayload(slug: string) {
  const row = bySlug.get(slug);
  const detail = catalog.details[slug];
  if (!row || !detail) return null;
  return { row, detail, meta: catalog.meta };
}

export function movementsPayload() {
  return {
    meta: catalog.meta,
    note: "Baseline snapshot. Rank moves, entrants and exits appear after the next collection. Nothing here is a prediction.",
  };
}

export function mysteriesPayload() {
  const unitemized = catalog.index.filter((row) => row.unitemized);
  const unpriced = catalog.index
    .filter((row) => {
      const detail = catalog.details[row.slug];
      return (
        row.sources.includes("gh") &&
        row.ghBeneficiaries >= 8 &&
        (detail?.bySource.gh ?? 0) === 0
      );
    })
    .sort((a, b) => b.ghBeneficiaries - a.ghBeneficiaries)
    .slice(0, 12);
  return { meta: catalog.meta, unitemized, unpriced };
}

export function graphPayload() {
  const ids = new Set<string>();
  for (const link of catalog.alliances) {
    ids.add(link.a);
    ids.add(link.b);
  }
  const nodes = catalog.index
    .filter((row) => ids.has(row.slug))
    .map((row) => ({
      id: row.slug,
      name: row.name,
      publicUsd: row.publicUsd,
      rank: row.rank,
    }));
  return {
    meta: catalog.meta,
    nodes,
    links: catalog.alliances,
    commons: catalog.commons,
  };
}

export function watchlistPayload() {
  const items: WatchItem[] = catalog.watchlist.map((item) => ({
    ...item,
    row: bySlug.get(item.slug) ?? null,
  }));
  const picker = catalog.index.map((row) => ({
    slug: row.slug,
    name: row.name,
    rank: row.rank,
    publicUsd: row.publicUsd,
    projects: row.projects,
  }));
  return { meta: catalog.meta, items, picker };
}

export function leaderboardQuery(params: URLSearchParams) {
  const sort = params.get("sort") === "projects" ? "projects" : params.get("sort") === "gh" ? "gh" : "public_usd";
  const limit = clampInt(params.get("limit"), 50, 1, 200);
  const offset = clampInt(params.get("offset"), 0, 0, 10_000);
  const includeWhales = params.get("include_whales") !== "false";
  const source = params.get("source");
  let rows = catalog.index.slice();
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
    collected_at: catalog.meta.collectedAt,
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
  const detail = catalog.details[slug];
  const row = bySlug.get(slug);
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
      collected_at: catalog.meta.collectedAt,
    })),
  };
}

export function deltasPayload(params: URLSearchParams) {
  return {
    from: params.get("from"),
    to: params.get("to") ?? catalog.meta.collectedAt,
    companies: [],
    summary: { risers: 0, fallers: 0, new_entrants: 0, exits: 0 },
    notable_rule: "A rank move of more than 5 positions is notable.",
    note: "Baseline snapshot 2026-10-05. No earlier collection is stored, so there is nothing to compare. No forecast is implied.",
  };
}

export function graphQuery(params: URLSearchParams) {
  const minShared = clampInt(params.get("min_shared"), 2, 2, 50);
  const limit = clampInt(params.get("limit"), 50, 1, 80);
  const pairs = catalog.alliances
    .filter((link) => link.shared >= minShared)
    .slice(0, limit)
    .map((link) => ({
      a: link.a,
      b: link.b,
      shared_projects: link.shared,
      projects: link.projects,
    }));
  return {
    collected_at: catalog.meta.collectedAt,
    min_shared: minShared,
    note: "Pairs that share distinctive projects (2–15 sponsors). Mega-collectives such as webpack are listed separately so the graph is not a hairball.",
    pairs,
  };
}

export function watchlistApi() {
  return {
    collected_at: catalog.meta.collectedAt,
    companies: catalog.watchlist.map((item) => {
      const row = bySlug.get(item.slug);
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
    collected_at: catalog.meta.collectedAt,
    alerts: [],
    note: "No prior snapshot, so no rank move, new sponsorship, or exit can be asserted.",
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
  ];
  const lines = catalog.index.map((row) =>
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
    ].map(csvCell),
  );
  return [header.join(","), ...lines.map((line) => line.join(","))].join("\n");
}

export function sponsorshipsCsv(): string {
  const header = ["slug", "company", "project", "source", "amount_usd", "cumulative", "visibility", "collected_at"];
  const lines: string[] = [];
  for (const row of catalog.index) {
    const detail = catalog.details[row.slug];
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
          catalog.meta.collectedAt,
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
  const meta = catalog.meta;
  const row = [
    meta.collectedAt,
    meta.hash,
    meta.companies,
    meta.sponsorships,
    meta.ranked,
    meta.publicUsdRanked,
    meta.publicUsdAll,
  ].map(csvCell);
  return [header.join(","), row.join(",")].join("\n");
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

/** Company slugs that pass the indexing gate (see `companyIndexable`). */
export function indexableCompanySlugs(isIndexable: (row: CompanyRow, detail: CatalogFile["details"][string] | undefined) => boolean): string[] {
  return catalog.index.filter((row) => isIndexable(row, catalog.details[row.slug])).map((row) => row.slug);
}
