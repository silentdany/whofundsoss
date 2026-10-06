/**
 * Project pages (P1-1): index named beneficiaries with gate ≥3 distinct companies.
 * Slots only: no free-form paraphrase. Pure module for node:test.
 */
import type { BySource, CompanyRow, Meta, SourceKey, Sponsorship } from "./types.ts";
import { isNamedProjectSlug } from "./sponsorship-url.ts";

export const PROJECT_SPONSOR_GATE = 3;

export type CompanyDetailLike = { bySource: BySource; sponsorships: Sponsorship[] };

export type ProjectSponsor = {
  companySlug: string;
  companyName: string;
  rank: number | null;
  amountUsd: number | null;
  source: SourceKey;
  cumulative: boolean;
  visibility: "public" | "hidden";
  /** Voice-pack dollar label next to the amount. */
  amountLabel: string | null;
};

export type ProjectRecord = {
  slug: string;
  name: string;
  sponsors: ProjectSponsor[];
  /** Distinct companies (≥ gate when published). */
  sponsorCount: number;
  /** Sum of public amounts (nulls ignored). */
  publicUsdSum: number;
};

export function projectSlugFromName(project: string): string {
  return project.trim().toLowerCase();
}

export function amountLabelFor(item: Pick<Sponsorship, "source" | "cumulative" | "visibility">): string | null {
  if (item.source === "oc") return "cumulative";
  if (item.source === "osp") return "annual pledge";
  if (item.source === "gh") return "monthly tier (not ×12)";
  return null;
}

/**
 * Build every named project → distinct company sponsors from the catalog.
 * Aggregate pledge lines are excluded (they name no project).
 */
export function buildProjectIndex(
  rows: CompanyRow[],
  details: Record<string, CompanyDetailLike | undefined>,
): Map<string, ProjectRecord> {
  const map = new Map<string, ProjectRecord>();

  for (const row of rows) {
    const detail = details[row.slug];
    if (!detail) continue;
    // One sponsorship line per (company, project slug): keep the highest public amount.
    const best = new Map<string, Sponsorship>();
    for (const item of detail.sponsorships) {
      if (item.aggregate) continue;
      if (!isNamedProjectSlug(item.project)) continue;
      const slug = projectSlugFromName(item.project);
      const prev = best.get(slug);
      if (!prev || (item.amountUsd ?? -1) > (prev.amountUsd ?? -1)) best.set(slug, item);
    }
    for (const [slug, item] of best) {
      let rec = map.get(slug);
      if (!rec) {
        rec = {
          slug,
          name: item.project.trim(),
          sponsors: [],
          sponsorCount: 0,
          publicUsdSum: 0,
        };
        map.set(slug, rec);
      }
      rec.sponsors.push({
        companySlug: row.slug,
        companyName: row.name,
        rank: row.rank,
        amountUsd: item.amountUsd,
        source: item.source,
        cumulative: item.cumulative,
        visibility: item.visibility,
        amountLabel: amountLabelFor(item),
      });
    }
  }

  for (const rec of map.values()) {
    rec.sponsors.sort((a, b) => (b.amountUsd ?? -1) - (a.amountUsd ?? -1) || a.companyName.localeCompare(b.companyName));
    rec.sponsorCount = rec.sponsors.length;
    rec.publicUsdSum = rec.sponsors.reduce((sum, s) => sum + (s.amountUsd ?? 0), 0);
  }
  return map;
}

/** Published project pages: gate ≥ PROJECT_SPONSOR_GATE distinct companies. */
export function gatedProjects(index: Map<string, ProjectRecord>): ProjectRecord[] {
  return [...index.values()]
    .filter((rec) => rec.sponsorCount >= PROJECT_SPONSOR_GATE)
    .sort((a, b) => b.sponsorCount - a.sponsorCount || a.slug.localeCompare(b.slug));
}

export function isProjectPublished(rec: ProjectRecord | undefined): boolean {
  return !!rec && rec.sponsorCount >= PROJECT_SPONSOR_GATE;
}

/** Slot-filled title (no paraphrase). */
export function projectTitle(name: string): string {
  return `Who funds ${name} · public sponsors · WhoFundsOSS`;
}

/** Slot-filled meta description. */
export function projectDescription(name: string, collectedAt: string): string {
  return `Companies that name ${name} in the WhoFundsOSS public record. Dollars only when already published. Snapshot ${collectedAt}. Nothing invented.`;
}

/** Slot-filled lead (exactly the voice-pack mass-gen pattern). */
export function projectLead(name: string, n: number, sumLabel: string): string {
  return `${n} companies name ${name} in this snapshot. Public dollars tied to the project: ${sumLabel}. Hidden GitHub tiers stay at zero.`;
}

/** Forbidden tokens for QA (voice pack §4.10). */
export const PROJECT_COPY_FORBIDDEN = [/—/, /\bunlock\b/i, /\bdiscover\b/i, /\bultimate\b/i] as const;

export function copyHasForbidden(text: string): boolean {
  return PROJECT_COPY_FORBIDDEN.some((re) => re.test(text));
}

/** Named project slugs on a company page that pass the publish gate. */
export function companyLinkedProjects(
  detail: CompanyDetailLike | undefined,
  published: ReadonlySet<string>,
): { slug: string; name: string }[] {
  if (!detail) return [];
  const out: { slug: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const item of detail.sponsorships) {
    if (item.aggregate) continue;
    if (!isNamedProjectSlug(item.project)) continue;
    const slug = projectSlugFromName(item.project);
    if (!published.has(slug) || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, name: item.project.trim() });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Parse pledge report year from an aggregate OSP project label, if present. */
export function pledgeYearFromDetail(detail: CompanyDetailLike | undefined): string | null {
  if (!detail) return null;
  for (const item of detail.sponsorships) {
    if (item.source !== "osp") continue;
    const m = item.project.match(/\b(20\d{2})\b/);
    if (m) return m[1]!;
  }
  return null;
}

/**
 * Company narrative lead (P1-2). Max 3 sentences. Slots only.
 * With pledge/OC split when both > 0; otherwise the short form.
 */
export function companyNarrativeLead(
  row: CompanyRow,
  detail: CompanyDetailLike | undefined,
  moneyFn: (n: number) => string,
): string[] {
  const sentences: string[] = [];
  const total = moneyFn(row.publicUsd);
  const oc = detail?.bySource.oc ?? 0;
  const osp = detail?.bySource.osp ?? 0;
  const named = detail
    ? detail.sponsorships.filter((s) => !s.aggregate && isNamedProjectSlug(s.project)).length
    : 0;

  if (row.unitemized || named === 0) {
    sentences.push(
      `${row.name} publishes ${total} and names no project in this file. Rank follows public dollars. Itemization does not.`,
    );
    return sentences.slice(0, 3);
  }

  const rankPhrase =
    row.rank === 1
      ? "Leads the public record"
      : row.rank
        ? `Rank ${row.rank} by public dollars`
        : "Outside the top 200";

  if (osp > 0 && oc > 0) {
    const year = pledgeYearFromDetail(detail);
    const pledgePart = year
      ? `${moneyFn(osp)} is the ${year} Open Source Pledge`
      : `${moneyFn(osp)} is the Open Source Pledge (annual pledge)`;
    sentences.push(
      `${rankPhrase} at ${total}. ${pledgePart}. ${moneyFn(oc)} is cumulative Open Collective, not a yearly run-rate.`,
    );
  } else if (osp > 0) {
    const year = pledgeYearFromDetail(detail);
    const pledgeBit = year ? `the ${year} Open Source Pledge` : "the Open Source Pledge (annual pledge)";
    sentences.push(`${rankPhrase} at ${total}. ${moneyFn(osp)} is ${pledgeBit}. Named projects: ${named}.`);
  } else if (oc > 0) {
    sentences.push(
      `${rankPhrase} at ${total}. ${moneyFn(oc)} is cumulative Open Collective, not a yearly run-rate. Named projects: ${named}.`,
    );
  } else {
    const sources = row.sources
      .map((k) => (k === "oc" ? "Open Collective" : k === "osp" ? "Pledge" : k === "gh" ? "GitHub" : "Own program"))
      .join(" · ");
    sentences.push(`Public total this snapshot: ${total}. Named projects: ${named}. Sources: ${sources}.`);
  }

  // Flatten to ≤3 sentences (templates already pack 3 into one string with periods).
  const flat = sentences.join(" ").split(/(?<=\.)\s+/).filter(Boolean);
  return flat.slice(0, 3);
}
