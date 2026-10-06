/**
 * SEO acceptance check (Phase 3/4/7 of the SEO pack).
 *
 *   node --experimental-strip-types scripts/seo-check.ts http://127.0.0.1:8081
 *   SEO_CHECK_HEADERS='{"x-vercel-protection-bypass":"…"}' node … scripts/seo-check.ts https://preview…
 *
 * Reads <base>/sitemap.xml, maps each <loc> onto <base> (canonical stays on
 * SITE_URL), fetches every page and asserts: title present, unique, ≤60 chars
 * (warn 61–70, fail >70); description unique, 120–160 (warn outside);
 * canonical = the sitemap <loc>; og:image absolute and 200 image/*;
 * exactly one <h1>; robots meta is not noindex. Exit 1 on any failure.
 */
const base = (process.argv[2] ?? "http://127.0.0.1:8081").replace(/\/+$/, "");
const headers: Record<string, string> = JSON.parse(process.env.SEO_CHECK_HEADERS ?? "{}");
const limit = Number(process.env.SEO_CHECK_LIMIT ?? "0");

type Page = { loc: string; url: string; title: string; description: string; canonical: string; ogImage: string; robots: string; h1: number; status: number };

function attr(html: string, re: RegExp): string {
  const match = html.match(re);
  return match ? decode(match[1] ?? "") : "";
}
function decode(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
function metaContent(html: string, key: string): string {
  const re = new RegExp(`<meta[^>]*(?:name|property)="${key.replace(/[.:]/g, "\\$&")}"[^>]*content="([^"]*)"`, "i");
  return attr(html, re);
}

async function get(url: string) {
  return fetch(url, { headers, redirect: "manual" });
}

const sitemapRes = await get(`${base}/sitemap.xml`);
if (sitemapRes.status !== 200) {
  console.error(`sitemap.xml → ${sitemapRes.status}`);
  process.exit(1);
}
const sitemap = await sitemapRes.text();
let locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]!));
if (limit > 0) locs = locs.slice(0, limit);

const pages: Page[] = [];
const failures: string[] = [];
const warnings: string[] = [];
const imageStatus = new Map<string, string>();

for (const loc of locs) {
  const path = new URL(loc).pathname;
  const url = `${base}${path === "/" ? "/" : path}`;
  const res = await get(url);
  const html = await res.text();
  const page: Page = {
    loc,
    url,
    status: res.status,
    title: attr(html, /<title[^>]*>([^<]*)<\/title>/i),
    description: metaContent(html, "description"),
    canonical: attr(html, /<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i),
    ogImage: metaContent(html, "og:image"),
    robots: metaContent(html, "robots"),
    h1: (html.match(/<h1[\s>]/gi) ?? []).length,
  };
  pages.push(page);
  const tag = path;
  if (page.status !== 200) failures.push(`${tag}: HTTP ${page.status}`);
  if (!page.title) failures.push(`${tag}: no <title>`);
  else if (page.title.length > 70) failures.push(`${tag}: title ${page.title.length} chars`);
  else if (page.title.length > 60) warnings.push(`${tag}: title ${page.title.length} chars`);
  if (!page.description) failures.push(`${tag}: no description`);
  else if (page.description.length < 120 || page.description.length > 160)
    warnings.push(`${tag}: description ${page.description.length} chars`);
  if (page.canonical !== loc) failures.push(`${tag}: canonical ${page.canonical} ≠ ${loc}`);
  if (page.h1 !== 1) failures.push(`${tag}: ${page.h1} <h1>`);
  if (/noindex/i.test(page.robots)) failures.push(`${tag}: robots ${page.robots} but listed in sitemap`);
  if (/\u2014/.test(page.title)) failures.push(`${tag}: em dash in title`);
  if (!/^https:\/\//.test(page.ogImage)) failures.push(`${tag}: og:image not absolute (${page.ogImage})`);
  else {
    if (!imageStatus.has(page.ogImage)) {
      const imagePath = new URL(page.ogImage).pathname;
      const img = await get(`${base}${imagePath}`);
      const type = img.headers.get("content-type") ?? "";
      const bytes = (await img.arrayBuffer()).byteLength;
      imageStatus.set(page.ogImage, img.status === 200 && type.startsWith("image/") && bytes < 300_000 ? "ok" : `${img.status} ${type} ${bytes}B`);
    }
    const state = imageStatus.get(page.ogImage);
    if (state !== "ok") failures.push(`${tag}: og:image ${state}`);
  }
}

const dupes = (key: "title" | "description") => {
  const seen = new Map<string, string[]>();
  for (const page of pages) {
    const value = page[key];
    if (!value) continue;
    seen.set(value, [...(seen.get(value) ?? []), new URL(page.loc).pathname]);
  }
  for (const [value, paths] of seen) if (paths.length > 1) failures.push(`duplicate ${key} on ${paths.join(", ")}: "${value.slice(0, 60)}"`);
};
dupes("title");
dupes("description");

console.log(JSON.stringify({ base, urls: pages.length, failures: failures.length, warnings: warnings.length }, null, 2));
for (const line of failures.slice(0, 50)) console.log(`FAIL ${line}`);
for (const line of warnings.slice(0, 30)) console.log(`warn ${line}`);
if (warnings.length > 30) console.log(`… ${warnings.length - 30} more warnings`);
process.exit(failures.length ? 1 : 0);
