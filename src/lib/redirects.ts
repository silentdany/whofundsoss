/**
 * Permanent (308) redirects. Old French slugs → English slugs, trailing slash and
 * upper-case page paths → their canonical form, plus the
 * host hop to SITE_URL once a custom domain is live. Always a single hop:
 * `whofundsoss.vercel.app/classement` goes straight to `{SITE_URL}/ranking`.
 */
export const SLUG_REDIRECTS: Record<string, string> = {
  "/classement": "/ranking",
  "/methode": "/method",
  "/mouvements": "/movements",
  "/mysteres": "/mysteries",
  "/graphe": "/graph",
  // Catalog merge 2026-10-06: nx-by-nrwl → nrwl (same nx.dev / GH login nrwl)
  "/company/nx-by-nrwl": "/company/nrwl",
};

/** Production alias that should hop to SITE_URL when SITE_URL is another host. */
export const LEGACY_PROD_HOST = "whofundsoss.vercel.app";

function stripPort(host: string): string {
  return host.split(",")[0]!.trim().split(":")[0]!.toLowerCase();
}

/**
 * Returns the absolute redirect target, or null. Pure, so it is unit-tested
 * without a server (scripts/redirects.test.mjs mirrors these cases).
 */
export function redirectTarget(requestUrl: URL, hostHeader: string, siteUrl: string): string | null {
  const host = stripPort(hostHeader || requestUrl.host);
  const site = new URL(siteUrl);
  const siteHost = site.host.toLowerCase();

  const rawPath = requestUrl.pathname;
  const trimmed = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath;
  const slugTarget = SLUG_REDIRECTS[trimmed.toLowerCase()];
  // Page routes are lowercase with no trailing slash. API, card and file URLs are left alone.
  const isPage = !/^\/(api|og|_)/i.test(trimmed) && !/\.[a-z0-9]+$/i.test(trimmed);
  const normalized = isPage ? trimmed.toLowerCase() : rawPath;
  const path = slugTarget ?? normalized;

  const hostHop =
    (host === LEGACY_PROD_HOST && siteHost !== LEGACY_PROD_HOST) ||
    (host.startsWith("www.") && host.slice(4) === siteHost);

  if (hostHop) return `${site.origin}${path}${requestUrl.search}`;
  if (slugTarget) return `${requestUrl.origin}${slugTarget}${requestUrl.search}`;
  if (isPage && normalized !== rawPath) return `${requestUrl.origin}${normalized}${requestUrl.search}`;
  return null;
}
