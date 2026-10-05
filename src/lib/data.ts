import ranking from "@/data/ranking.json";
import featured from "@/data/featured.json";
import companies from "@/data/companies.json";
import { platformTokens } from "@/lib/format";

export type RankingRow = {
  rank: number;
  slug: string;
  name: string;
  login: string;
  projects: number;
  beneficiairesGithub: number;
  totalPublicUsd: number | null;
  plateformes: string;
  site: string;
};

export type ProjectRow = {
  project: string;
  type: string;
  platform: string;
  monthly: number | null;
  total: number | null;
  currency: string;
  visibility: string;
  since: string;
  actif: boolean;
  exclusion: string;
};

export type Company = {
  slug: string;
  name: string;
  login: string;
  site: string;
  secteur: string;
  totalPublicUsd: number | null;
  beneficiairesGithub: number;
  beneficiairesOc: number;
  plateformes: string;
  contact: string;
  exclusion: string;
  dateVerif: string;
  projectsCount: number;
  projects: ProjectRow[];
};

export type RankingStats = {
  companies: number;
  publicUsd: number;
  sources: number;
};

export function getRanking(): RankingRow[] {
  return ranking as RankingRow[];
}

export function getFeatured(): RankingRow | null {
  return (featured as RankingRow | null) ?? null;
}

export function getCompany(slug: string): Company | null {
  const map = companies as Record<string, Company>;
  return map[slug] ?? null;
}

export function getCompanySlugs(): string[] {
  return Object.keys(companies as Record<string, Company>);
}

/** Aggregate metrics for the Discover Steward StatsStrip (from ranking data only). */
export function getRankingStats(): RankingStats {
  const rows = getRanking();
  const sourceSet = new Set<string>();
  let publicUsd = 0;
  for (const row of rows) {
    if (typeof row.totalPublicUsd === "number") {
      publicUsd += row.totalPublicUsd;
    }
    for (const token of platformTokens(row.plateformes)) {
      sourceSet.add(token);
    }
  }
  return {
    companies: rows.length,
    publicUsd,
    sources: sourceSet.size,
  };
}
