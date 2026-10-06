/**
 * Single source of truth for brand + absolute URLs (canonical, sitemap, OG,
 * JSON-LD). `SITE_URL` is read from the build env (see vite.config.ts
 * `define`), so server render and client navigation agree. Set
 * `SITE_URL=https://whofundsoss.com` in Vercel once the domain is attached,
 * then redeploy.
 */
export const SITE_NAME = "WhoFundsOSS";
export const SITE_ALT_NAME = "Who Funds OSS";
export const SITE_TAGLINE = "Who really funds open source";
export const DEFAULT_DESCRIPTION =
  "Public ranking of companies that fund open source: Open Source Pledge, Open Collective and visible GitHub Sponsors dollars. Updated monthly. Nothing invented.";
export const TITLE_SEPARATOR = " · ";
export const TITLE_TEMPLATE = `%s${TITLE_SEPARATOR}${SITE_NAME}`;
export const SITE_URL_FALLBACK = "https://whofundsoss.vercel.app";
export const REPO_URL = "https://github.com/silentdany/whofundsoss";

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_TYPE = "image/jpeg";

function normalizeBase(raw: string | undefined): string {
  const value = String(raw ?? "").trim();
  if (!/^https?:\/\/[^/\s]+/i.test(value)) return SITE_URL_FALLBACK;
  return value.replace(/\/+$/, "");
}

/**
 * `import.meta.env.SITE_URL` is inlined by Vite. The try keeps `node --test`
 * on this module from throwing when `import.meta.env` is absent.
 */
function readDefinedSiteUrl(): string | undefined {
  try {
    return import.meta.env.SITE_URL;
  } catch {
    return undefined;
  }
}

export const SITE_URL = normalizeBase(readDefinedSiteUrl());

/** Absolute URL on SITE_URL, without query, hash or trailing slash. */
export function absoluteUrl(path = "/"): string {
  const clean = String(path).split(/[?#]/, 1)[0] || "/";
  const withSlash = clean.startsWith("/") ? clean : `/${clean}`;
  const trimmed = withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : "";
  return `${SITE_URL}${trimmed}`;
}

export function formatTitle(page: string): string {
  return TITLE_TEMPLATE.replace("%s", page);
}

/** Document titles shared by route heads and the dynamic share cards. */
export const PAGE_TITLES = {
  home: `${SITE_NAME}${TITLE_SEPARATOR}${SITE_TAGLINE}`,
  ranking: formatTitle("Open source funding ranking: top companies"),
  movements: formatTitle("Open source funding changes this month"),
  mysteries: formatTitle("Declared but unnamed: pledges without projects"),
  graph: formatTitle("Who funds the same open source projects"),
  watchlist: formatTitle("Open source funding watchlist"),
  method: formatTitle("Method: how we count open source funding"),
} as const;

/** Absolute path of the dynamic share card for a public page. */
export function ogImagePath(pagePath: string): string {
  const clean = String(pagePath).split(/[?#]/, 1)[0] || "/";
  const withSlash = clean.startsWith("/") ? clean : `/${clean}`;
  const trimmed = withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : "/";
  if (trimmed === "/") return "/og/home.jpg";
  return `/og${trimmed}.jpg`;
}
