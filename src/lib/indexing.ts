/**
 * Indexing gate for /company/[slug] and sitemap.xml. Pure (relative imports
 * only) so it is unit-tested with `node --experimental-strip-types`.
 */
import { isSpamDenylisted } from "./spam-denylist.ts";
import type { BySource, CompanyRow, Sponsorship } from "./types.ts";

export type CompanyDetail = { bySource: BySource; sponsorships: Sponsorship[] };

/** Indexable static pages. Old FR slugs are redirects and never listed. */
export const STATIC_PATHS = ["/", "/ranking", "/movements", "/method", "/denylist", "/mysteries", "/graph", "/watchlist"];

/** Distinct named projects (aggregate pledge lines name no project). */
export function namedProjects(detail: CompanyDetail | undefined): Sponsorship[] {
  if (!detail) return [];
  const best = new Map<string, Sponsorship>();
  for (const item of detail.sponsorships) {
    if (item.aggregate) continue;
    const prev = best.get(item.project);
    if (!prev || (item.amountUsd ?? -1) > (prev.amountUsd ?? -1)) best.set(item.project, item);
  }
  return [...best.values()];
}

/** Not denylisted, and public dollars or at least 3 named projects. */
export function companyIndexable(row: CompanyRow, detail: CompanyDetail | undefined): boolean {
  if (isSpamDenylisted(row.slug)) return false;
  return row.publicUsd > 0 || namedProjects(detail).length >= 3;
}

/** Sitemap paths: static pages + every index-eligible company, in catalog order. */
export function sitemapPaths(rows: CompanyRow[], details: Record<string, CompanyDetail | undefined>): string[] {
  return [
    ...STATIC_PATHS,
    ...rows
      .filter((row) => companyIndexable(row, details[row.slug]))
      .map((row) => `/company/${encodeURIComponent(row.slug)}`),
  ];
}
