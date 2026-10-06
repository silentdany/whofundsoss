import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { markShapes } from "../brand-mark.ts";
import { companyTitle } from "../seo.ts";
import { OG_IMAGE_HEIGHT, OG_IMAGE_TYPE, OG_IMAGE_WIDTH, PAGE_TITLES } from "../site.ts";
import type { CompanyRow } from "../types.ts";

export type OgPhoto = "hero" | "meadow" | "sky";

export type OgSpec = {
  path: string;
  title: string;
  /** Short label printed on the card. Company pages use the company name. */
  label: string;
  photo: OgPhoto;
};

const PHOTOS: OgPhoto[] = ["hero", "meadow", "sky"];

const STATIC_PAGES: Record<string, Omit<OgSpec, "path">> = {
  "/": { title: PAGE_TITLES.home, label: "Home", photo: "hero" },
  "/ranking": { title: PAGE_TITLES.ranking, label: "Ranking", photo: "meadow" },
  "/movements": { title: PAGE_TITLES.movements, label: "Movements", photo: "sky" },
  "/mysteries": { title: PAGE_TITLES.mysteries, label: "Mysteries", photo: "meadow" },
  "/graph": { title: PAGE_TITLES.graph, label: "Graph", photo: "sky" },
  "/watchlist": { title: PAGE_TITLES.watchlist, label: "Watchlist", photo: "hero" },
  "/method": { title: PAGE_TITLES.method, label: "Method", photo: "meadow" },
};

let rootCache: string | null = null;
let rowsCache: CompanyRow[] | null = null;

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

function rows(): CompanyRow[] {
  if (rowsCache) return rowsCache;
  const raw = JSON.parse(readFileSync(join(repoRoot(), "src/data/catalog.json"), "utf8")) as {
    index: CompanyRow[];
  };
  rowsCache = raw.index;
  return rowsCache;
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
  if (!path.startsWith("/company/")) return null;
  const slug = decodeURIComponent(path.slice("/company/".length));
  if (!slug || slug.includes("/")) return null;
  const row = rows().find((item) => item.slug === slug);
  if (!row) return null;
  return {
    path,
    title: companyTitle(row),
    label: row.name,
    photo: photoForSlug(slug),
  };
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

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}

function fitTitle(
  text: string,
  maxWidth: number,
): { lines: string[]; size: number; leading: number } {
  for (const size of [48, 40, 34]) {
    const maxChars = Math.max(12, Math.floor(maxWidth / (size * 0.52)));
    const lines = wrapLines(text, maxChars);
    if (lines.length <= 3) return { lines, size, leading: Math.round(size * 1.2) };
  }
  const size = 32;
  const maxChars = Math.max(12, Math.floor(maxWidth / (size * 0.52)));
  const lines = wrapLines(text, maxChars).slice(0, 3);
  const last = lines[lines.length - 1] ?? "";
  lines[lines.length - 1] =
    last.length > maxChars ? `${last.slice(0, maxChars - 1).trimEnd()}…` : last;
  return { lines, size, leading: Math.round(size * 1.18) };
}

/** SVG overlay: paper plate, the shared mark, the page title. Transparent elsewhere. */
export function ogOverlaySvg(spec: OgSpec): string {
  const fitted = fitTitle(spec.title, 700);
  const titleY = 392;
  const lastBaseline = titleY + (fitted.lines.length - 1) * fitted.leading;
  const cardBottom = Math.min(OG_IMAGE_HEIGHT - 36, lastBaseline + 52);
  const cardY = 214;
  const label = spec.label.length > 32 ? `${spec.label.slice(0, 31).trimEnd()}…` : spec.label;
  const texts = fitted.lines
    .map(
      (line, index) =>
        `<text x="80" y="${titleY + index * fitted.leading}" font-family="DejaVu Serif" font-size="${fitted.size}" fill="#1a1a1a">${xml(line)}</text>`,
    )
    .join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}">
  <title>${xml(spec.title)}</title>
  <rect x="48" y="${cardY}" width="820" height="${cardBottom - cardY}" rx="36" fill="#ffffff"/>
  <svg id="brand-mark" x="80" y="246" width="72" height="72" viewBox="0 0 512 512">${markShapes()}</svg>
  <text x="168" y="290" font-family="DejaVu Sans" font-size="24" font-weight="700" fill="#1a1a1a">WhoFundsOSS</text>
  <text x="820" y="290" text-anchor="end" font-family="DejaVu Sans" font-size="22" fill="#3d7a6a">${xml(label)}</text>
  ${texts}
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

/** JPEG share card for a public page. Null when that page has no card. */
export async function renderOgCard(pagePath: string): Promise<OgCard | null> {
  const cached = cardCache.get(pagePath);
  if (cached) return cached;
  const spec = specForPath(pagePath);
  if (!spec) return null;
  const svg = ogOverlaySvg(spec);
  const photo = join(repoRoot(), "public/art", `${spec.photo}.jpg`);
  const base = await sharp(photo)
    .resize(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT, { fit: "cover", position: "centre" })
    .jpeg({ quality: 72 })
    .toBuffer();
  const overlay = await sharp(Buffer.from(svg)).png().toBuffer();
  const jpeg = await sharp(base)
    .composite([{ input: overlay }])
    .jpeg({ quality: 72 })
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
