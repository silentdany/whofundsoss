import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import catalogFile from "../../data/catalog.json" with { type: "json" };
import { GLYPHS, type GlyphFace } from "./glyphs.ts";
import { markShapes } from "../brand-mark.ts";
import { buildProjectIndex, isProjectPublished, projectTitle } from "../projects.ts";
import { money } from "../format.ts";
import { companyTitle } from "../seo.ts";
import { OG_IMAGE_HEIGHT, OG_IMAGE_TYPE, OG_IMAGE_WIDTH, PAGE_TITLES, SITE_URL } from "../site.ts";
import type { CompanyRow } from "../types.ts";

export type OgPhoto = "hero" | "meadow" | "sky";

export type OgSpec = {
  path: string;
  /** Full SEO title. Kept in the SVG <title> and the JPEG comment, never printed. */
  title: string;
  /** Short label for the page (company name, "Ranking"...). */
  label: string;
  /** Big line printed on the card. Never repeats the brand name. */
  headline: string;
  /** Small caps line above the headline. */
  kicker: string;
  /** One supporting line under the headline (a real figure when we have one). */
  stat?: string;
  photo: OgPhoto;
};

const PHOTOS: OgPhoto[] = ["hero", "meadow", "sky"];

const catalogMeta = (catalogFile as { meta: { publicUsdRanked: number; ranked: number; companies: number } }).meta;

const STATIC_PAGES: Record<string, Omit<OgSpec, "path">> = {
  "/": {
    title: PAGE_TITLES.home,
    label: "Home",
    kicker: "The public record",
    headline: "Who really funds open source.",
    stat: `${money(catalogMeta.publicUsdRanked)} public floor across ${catalogMeta.ranked} companies`,
    photo: "hero",
  },
  "/ranking": {
    title: PAGE_TITLES.ranking,
    label: "Ranking",
    kicker: "Ranking",
    headline: "Who gives the most, in public dollars.",
    stat: `${catalogMeta.ranked} companies, sorted by what they have published`,
    photo: "meadow",
  },
  "/movements": {
    title: PAGE_TITLES.movements,
    label: "Movements",
    kicker: "Movements",
    headline: "What changed since the last snapshot.",
    stat: "Who started, raised or stopped funding",
    photo: "sky",
  },
  "/mysteries": {
    title: PAGE_TITLES.mysteries,
    label: "Mysteries",
    kicker: "Mysteries",
    headline: "Numbers that don't add up yet.",
    stat: "Declared dollars, hidden prices. Flagged, never guessed.",
    photo: "meadow",
  },
  "/graph": {
    title: PAGE_TITLES.graph,
    label: "Graph",
    kicker: "Graph",
    headline: "Who funds the same work.",
    stat: "Companies linked by the projects they back together",
    photo: "sky",
  },
  "/watchlist": {
    title: PAGE_TITLES.watchlist,
    label: "Watchlist",
    kicker: "Watchlist",
    headline: "Companies worth following.",
    stat: "A short list, with the reason for each",
    photo: "hero",
  },
  "/method": {
    title: PAGE_TITLES.method,
    label: "Method",
    kicker: "Method",
    headline: "How a number gets onto this site.",
    stat: "Only published dollars. Nothing annualized, nothing inferred.",
    photo: "meadow",
  },
  "/denylist": {
    title: PAGE_TITLES.denylist,
    label: "Denylist",
    kicker: "Transparency",
    headline: "The spam denylist, in the open.",
    stat: "Every excluded page, with its reason",
    photo: "sky",
  },
};

const companyRows = (catalogFile as { index: CompanyRow[] }).index;
const projectIndex = buildProjectIndex(
  companyRows,
  (catalogFile as { details: Record<string, { bySource: import("../types.ts").BySource; sponsorships: import("../types.ts").Sponsorship[] }> }).details,
);

let rootCache: string | null = null;

export function repoRoot(): string {
  if (rootCache) return rootCache;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name?: string };
      if (pkg.name === "whofundsoss") {
        rootCache = dir;
        return dir;
      }
    } catch {
      // keep walking
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  rootCache = process.cwd();
  return rootCache;
}

function photoForSlug(slug: string): OgPhoto {
  let hash = 0;
  for (const char of slug) hash = (hash + char.charCodeAt(0)) % PHOTOS.length;
  return PHOTOS[hash] ?? "meadow";
}

/** Page the share-card URL belongs to, or null when the path has no card. */
export function specForPath(pagePath: string): OgSpec | null {
  const path = pagePath.length > 1 ? pagePath.replace(/\/+$/, "") : "/";
  const staticPage = STATIC_PAGES[path];
  if (staticPage) return { path, ...staticPage };
  if (path.startsWith("/company/")) {
    const slug = decodeURIComponent(path.slice("/company/".length));
    if (!slug || slug.includes("/")) return null;
    const row = companyRows.find((item) => item.slug === slug);
    if (!row) return null;
    return {
      path,
      title: companyTitle(row),
      label: row.name,
      kicker: row.rank ? `Company · Rank ${row.rank} of ${catalogMeta.ranked}` : "Company",
      headline: row.name,
      stat:
        row.publicUsd > 0
          ? `${money(row.publicUsd)} in public open source funding`
          : "Amount not public",
      photo: photoForSlug(slug),
    };
  }
  if (path.startsWith("/project/")) {
    const slug = decodeURIComponent(path.slice("/project/".length));
    if (!slug || slug.includes("/")) return null;
    const project = projectIndex.get(slug.toLowerCase());
    if (!isProjectPublished(project)) return null;
    return {
      path,
      title: projectTitle(project!.name),
      label: project!.name,
      kicker: "Open source project",
      headline: project!.name,
      stat: `Funded by ${project!.sponsorCount} companies, from public records`,
      photo: photoForSlug(slug),
    };
  }
  return null;
}

/** `/og/home.jpg` and `/og/company/posit-dev.jpg` → page path. */
export function pagePathFromOgSplat(splat: string): string | null {
  const clean = splat.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!clean.endsWith(".jpg") || clean.includes("..")) return null;
  const stem = clean.slice(0, -".jpg".length);
  if (stem === "home") return "/";
  if (!/^[a-z0-9][a-z0-9/-]*$/i.test(stem)) return null;
  return `/${stem}`;
}

function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Font = GlyphFace;

function advance(font: Font, ch: string): number {
  return font.adv[ch] ?? font.adv["?"] ?? 0;
}

function textWidth(font: Font, text: string, size: number, tracking = 0): number {
  const chars = [...text];
  const scale = size / font.upm;
  return chars.reduce((sum, ch) => sum + advance(font, ch) * scale + tracking * size, 0) - (chars.length ? tracking * size : 0);
}

/**
 * Text as vector paths (the Vercel function has no system fonts). Outlines come
 * from scripts/build-og-glyphs.py. No kerning: opentype.js 2.0 turned some GPOS
 * pairs into NaN, so advances are laid out by hand.
 */
function glyphPath(
  font: Font,
  text: string,
  x: number,
  y: number,
  size: number,
  fill: string,
  anchor: "start" | "end" = "start",
  opacity = 1,
  tracking = 0,
): string {
  const scale = size / font.upm;
  let cursor = anchor === "end" ? x - textWidth(font, text, size, tracking) : x;
  const paths: string[] = [];
  for (const ch of text) {
    const d = font.d[ch] ?? (font.adv[ch] === undefined ? font.d["?"] : undefined);
    if (d) {
      paths.push(
        `<path transform="translate(${cursor.toFixed(2)} ${y}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})" d="${d}"/>`,
      );
    }
    cursor += advance(font, ch) * scale + tracking * size;
  }
  return paths.length
    ? `<g fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ""}>${paths.join("")}</g>`
    : "";
}

const W = OG_IMAGE_WIDTH;
const H = OG_IMAGE_HEIGHT;
const LEFT = 72;
const TEXT_WIDTH = 760;

function wrapMeasured(font: Font, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (current && textWidth(font, next, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}

function fitHeadline(font: Font, text: string): { lines: string[]; size: number; leading: number } {
  for (const size of [84, 72, 62, 54, 46]) {
    const lines = wrapMeasured(font, text, size, TEXT_WIDTH);
    const widest = Math.max(...lines.map((line) => textWidth(font, line, size)));
    if (lines.length <= 3 && widest <= TEXT_WIDTH + 40) return { lines, size, leading: Math.round(size * 1.08) };
  }
  const size = 42;
  const lines = wrapMeasured(font, text, size, TEXT_WIDTH).slice(0, 3);
  return { lines, size, leading: Math.round(size * 1.1) };
}

function clip(font: Font, text: string, size: number, maxWidth: number): string {
  if (textWidth(font, text, size) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && textWidth(font, `${out}…`, size) > maxWidth) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}

/**
 * SVG overlay: teal scrim over the painting, the brand lockup once, a small-caps
 * kicker, the page headline in the site serif, one supporting line, the host.
 * Everything is drawn as paths so no font has to exist on the server.
 */
export function ogOverlaySvg(spec: OgSpec): string {
  const fonts = GLYPHS;
  const fitted = fitHeadline(fonts.serif, spec.headline);
  const block = fitted.size + (fitted.lines.length - 1) * fitted.leading;
  const hasStat = Boolean(spec.stat);
  // Vertically centre kicker + headline + stat in the area under the lockup.
  const total = 30 + 28 + block + (hasStat ? 52 : 0);
  const top = Math.round(110 + (H - 110 - 90 - total) / 2) + 6;
  const kickerY = top + 22;
  const headTop = kickerY + 28;
  const firstBaseline = headTop + Math.round(fitted.size * 0.82);
  const headline = fitted.lines
    .map((line, index) =>
      glyphPath(fonts.serif, line, LEFT, firstBaseline + index * fitted.leading, fitted.size, "#ffffff"),
    )
    .join("\n  ");
  const statY = firstBaseline + (fitted.lines.length - 1) * fitted.leading + 64;
  const kicker = spec.kicker.toUpperCase();
  const stat = spec.stat ? clip(fonts.sans, spec.stat, 30, 900) : "";
  const host = SITE_URL.replace(/^https?:\/\//, "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <title>${xml(spec.title)}</title>
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0.25">
      <stop offset="0" stop-color="#0b2f2c" stop-opacity="0.92"/>
      <stop offset="0.5" stop-color="#124743" stop-opacity="0.70"/>
      <stop offset="1" stop-color="#1c5c56" stop-opacity="0.06"/>
    </linearGradient>
    <linearGradient id="foot" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0d3532" stop-opacity="0"/>
      <stop offset="1" stop-color="#0d3532" stop-opacity="0.55"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#scrim)"/>
  <rect y="${H - 160}" width="${W}" height="160" fill="url(#foot)"/>
  <svg id="brand-mark" x="${LEFT}" y="56" width="52" height="52" viewBox="0 0 512 512">${markShapes()}</svg>
  ${glyphPath(fonts.bold, "WhoFundsOSS", LEFT + 68, 92, 28, "#ffffff")}
  ${glyphPath(fonts.bold, kicker, LEFT, kickerY, 21, "#bfe3d8", "start", 1, 0.14)}
  ${headline}
  ${stat ? glyphPath(fonts.sans, stat, LEFT, statY, 30, "#ffffff", "start", 0.88) : ""}
  <rect x="${LEFT}" y="${H - 86}" width="48" height="3" rx="1.5" fill="#bfe3d8"/>
  ${glyphPath(fonts.sans, host, LEFT, H - 46, 22, "#ffffff", "start", 0.8)}
</svg>
`;
}

function jpegComment(jpeg: Buffer, comment: string): Buffer {
  const text = Buffer.from(comment, "utf8");
  const segment = Buffer.alloc(4 + text.length);
  segment[0] = 0xff;
  segment[1] = 0xfe;
  segment.writeUInt16BE(text.length + 2, 2);
  text.copy(segment, 4);
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return jpeg;
  return Buffer.concat([jpeg.subarray(0, 2), segment, jpeg.subarray(2)]);
}

export type OgCard = {
  contentType: typeof OG_IMAGE_TYPE;
  body: Buffer;
  /** Overlay composited onto the landing photo. */
  svg: string;
  spec: OgSpec;
};

const cardCache = new Map<string, OgCard>();

/**
 * Landing photo for the card. The dev server and local preview have
 * `public/art` on disk. The Vercel function does not: `public/` is static
 * CDN output, so a missing file is loaded from the site itself.
 */
export async function photoBytes(
  photo: OgPhoto,
  options?: { root?: string; origin?: string },
): Promise<Buffer> {
  const root = options?.root ?? repoRoot();
  try {
    return readFileSync(join(root, "public", "art", `${photo}.jpg`));
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "ENOENT") throw error;
  }
  const bases = [options?.origin, SITE_URL].filter((value): value is string => Boolean(value));
  let last = "no origin";
  for (const base of [...new Set(bases)]) {
    const url = `${base.replace(/\/+$/, "")}/art/${photo}.jpg`;
    const response = await fetch(url);
    if (!response.ok) {
      last = `${response.status} ${url}`;
      continue;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 32 && bytes[0] === 0xff && bytes[1] === 0xd8) return bytes;
    last = `not a jpeg ${url}`;
  }
  throw new Error(`OG photo ${photo} is not on disk and not on the site (${last})`);
}

/** JPEG share card for a public page. Null when that page has no card. */
export async function renderOgCard(pagePath: string, origin?: string): Promise<OgCard | null> {
  const cached = cardCache.get(pagePath);
  if (cached) return cached;
  const spec = specForPath(pagePath);
  if (!spec) return null;
  const svg = ogOverlaySvg(spec);
  const photo = await photoBytes(spec.photo, origin ? { origin } : undefined);
  const base = await sharp(photo)
    .resize(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT, { fit: "cover", position: "centre" })
    .jpeg({ quality: 80 })
    .toBuffer();
  const overlay = await sharp(Buffer.from(svg)).png().toBuffer();
  const jpeg = await sharp(base)
    .composite([{ input: overlay }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  const card: OgCard = {
    contentType: OG_IMAGE_TYPE,
    body: jpegComment(jpeg, `${spec.title}\nbrand-mark`),
    svg,
    spec,
  };
  cardCache.set(pagePath, card);
  return card;
}
