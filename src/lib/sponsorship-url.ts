/**
 * Outbound public-source URL for a sponsorship line (P0-5).
 * Skip when the project name is missing or not a stable public slug.
 * Future `/project/{slug}` pages can reuse the same slug key.
 */
import type { Sponsorship } from "./types.ts";

/** Slug-ish project key for anchors and future /project routes. */
export function projectAnchorId(project: string): string {
  return project
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** True when `project` looks like a real beneficiary slug (not an aggregate label). */
export function isNamedProjectSlug(project: string): boolean {
  const name = project.trim();
  if (!name) return false;
  if (name.startsWith("(") || name.includes("agrégé") || name.includes("agreg")) return false;
  if (/^aggregated oss\b/i.test(name)) return false;
  if (/\s{2,}/.test(name)) return false;
  // OC / GH slugs are typically one token; allow dots and hyphens.
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(name);
}

/**
 * EN UI label for sponsorship project names (Soft Copy).
 * FR dump labels like `(agrégé OSS — N devs × $X/dev, rapport YYYY)` become
 * `Aggregated OSS, N devs × $X/dev, YYYY report`. Never emits an em dash.
 */
const AGGREGATE_FR =
  /^\(agrégé OSS [—–-] (\d+) devs? × \$(\d+)\/dev, rapport (\d{4})\)$/i;

export function formatSponsorshipProjectLabel(project: string): string {
  const raw = project.trim();
  const m = raw.match(AGGREGATE_FR);
  if (m) {
    const n = Number(m[1]);
    const per = m[2]!;
    const year = m[3]!;
    const devWord = n === 1 ? "dev" : "devs";
    return `Aggregated OSS, ${n} ${devWord} × $${per}/dev, ${year} report`;
  }
  // Soft Copy: no em dash anywhere in UI labels.
  return raw.replace(/\u2014/g, ",").replace(/\u2013/g, "-");
}

/**
 * Public source page for this line, or null when unknown.
 * - oc → https://opencollective.com/{slug}
 * - gh → https://github.com/sponsors/{login}
 * - osp aggregate → https://opensourcepledge.com/members (member slug ≠ catalog slug)
 * - own → null (company site is already linked in the header)
 */
export function sponsorshipSourceUrl(item: Sponsorship): string | null {
  if (item.source === "osp") {
    return "https://opensourcepledge.com/members";
  }
  if (item.source === "own") return null;
  if (!isNamedProjectSlug(item.project)) return null;
  const slug = encodeURIComponent(item.project.trim());
  if (item.source === "oc") return `https://opencollective.com/${slug}`;
  if (item.source === "gh") return `https://github.com/sponsors/${slug}`;
  return null;
}
