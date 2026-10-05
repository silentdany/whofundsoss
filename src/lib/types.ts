export type SourceKey = "oc" | "osp" | "gh" | "own";

export type CompanyRow = {
  slug: string;
  name: string;
  site: string | null;
  sector: string | null;
  rank: number | null;
  publicUsd: number;
  projects: number;
  ghBeneficiaries: number;
  sources: SourceKey[];
  whale: boolean;
  transparency: number;
  volume: number;
  coverage: number;
  projectsWithAmount: number;
  unitemized: boolean;
  lowVolume: boolean;
  dedupedPledge: boolean;
};

export type Sponsorship = {
  project: string;
  source: SourceKey;
  amountUsd: number | null;
  cumulative: boolean;
  visibility: "public" | "hidden";
  aggregate: boolean;
};

export type BySource = Record<SourceKey, number>;

export type Meta = {
  collectedAt: string;
  companies: number;
  sponsorships: number;
  ranked: number;
  publicUsdRanked: number;
  publicUsdAll: number;
  whales: number;
  maxPublicUsd: number;
  featuredSlug: string;
  cron: string;
  hash: string;
  exclusions: {
    spamCompanies: number;
    spamUsd: number;
    selfFundCompanies: number;
    selfFundUsd: number;
    note: string;
  };
};

export type BriefLine = {
  href: string;
  title: string;
  text: string;
};

export type Alliance = {
  a: string;
  b: string;
  shared: number;
  projects: string[];
};

export type Commons = {
  project: string;
  sponsors: number;
  funders: { slug: string; name: string; amountUsd: number }[];
};

export type WatchItem = {
  slug: string;
  reason: string;
  added: string;
  row: CompanyRow | null;
};

export const SOURCE_LABEL: Record<SourceKey, string> = {
  oc: "Open Collective",
  osp: "Pledge",
  gh: "GitHub",
  own: "Own program",
};

export const SOURCE_SHORT: Record<SourceKey, string> = {
  oc: "OC",
  osp: "Pledge",
  gh: "GitHub",
  own: "Program",
};

export const SOURCE_ORDER: SourceKey[] = ["oc", "osp", "gh", "own"];
