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

export const OG_IMAGE_PATH = "/og.jpg";
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_TYPE = "image/jpeg";
export const OG_IMAGE_ALT = "WhoFundsOSS: who funds open source";

function normalizeBase(raw: string | undefined): string {
  const value = String(raw ?? "").trim();
  if (!/^https?:\/\/[^/\s]+/i.test(value)) return SITE_URL_FALLBACK;
  return value.replace(/\/+$/, "");
}

export const SITE_URL = normalizeBase(import.meta.env.SITE_URL);

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
