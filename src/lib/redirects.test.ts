import { test } from "node:test";
import assert from "node:assert/strict";
import { redirectTarget, SLUG_REDIRECTS } from "./redirects.ts";

const VERCEL = "https://whofundsoss.vercel.app";
const COM = "https://whofundsoss.com";

test("each French slug 308s to its English slug on the same origin", () => {
  for (const [from, to] of Object.entries(SLUG_REDIRECTS)) {
    const url = new URL(`${VERCEL}${from}`);
    assert.equal(redirectTarget(url, url.host, VERCEL), `${VERCEL}${to}`);
  }
});

test("trailing slash, case and query are handled", () => {
  const url = new URL(`${VERCEL}/Classement/?source=oc`);
  assert.equal(redirectTarget(url, url.host, VERCEL), `${VERCEL}/ranking?source=oc`);
});

test("English paths and previews are left alone while SITE_URL is the vercel.app", () => {
  for (const path of ["/", "/ranking", "/company/posit-dev", "/robots.txt"]) {
    const url = new URL(`${VERCEL}${path}`);
    assert.equal(redirectTarget(url, url.host, VERCEL), null);
  }
  const preview = new URL("https://whofundsoss-abc-silentdanys-projects.vercel.app/ranking");
  assert.equal(redirectTarget(preview, preview.host, COM), null);
});

test("legacy vercel.app host hops to SITE_URL in one step, new slug included", () => {
  const url = new URL(`${VERCEL}/classement`);
  assert.equal(redirectTarget(url, url.host, COM), `${COM}/ranking`);
  const company = new URL(`${VERCEL}/company/posit-dev`);
  assert.equal(redirectTarget(company, company.host, COM), `${COM}/company/posit-dev`);
});

test("www goes to the apex", () => {
  const url = new URL("https://www.whofundsoss.com/methode");
  assert.equal(redirectTarget(url, url.host, COM), `${COM}/method`);
});

test("dropped catalog slug nx-by-nrwl 308s to nrwl", () => {
  const url = new URL(`${VERCEL}/company/nx-by-nrwl`);
  assert.equal(redirectTarget(url, url.host, VERCEL), `${VERCEL}/company/nrwl`);
  const withSlash = new URL(`${VERCEL}/company/nx-by-nrwl/`);
  assert.equal(redirectTarget(withSlash, withSlash.host, VERCEL), `${VERCEL}/company/nrwl`);
});

test("page paths are normalized to lowercase without a trailing slash, files and APIs are not", () => {
  const cases: [string, string | null][] = [
    ["/Ranking", `${VERCEL}/ranking`],
    ["/company/posit-dev/", `${VERCEL}/company/posit-dev`],
    ["/Company/Posit-Dev/?x=1", `${VERCEL}/company/posit-dev?x=1`],
    ["/", null],
    ["/api/v1/leaderboard", null],
    ["/og/company/posit-dev.jpg", null],
    ["/sitemap.xml", null],
    ["/manifest.webmanifest", null],
  ];
  for (const [path, expected] of cases) {
    const url = new URL(`${VERCEL}${path}`);
    assert.equal(redirectTarget(url, url.host, VERCEL), expected, path);
  }
});

test("canonical-slug renames: 308 old -> new once the catalog has the new key", async () => {
  const { COMPANY_SLUG_RENAMES } = await import("./redirects.ts");
  assert.equal(COMPANY_SLUG_RENAMES.size, 13);
  assert.equal(COMPANY_SLUG_RENAMES.get("et-reo"), "etereo");
  assert.equal(COMPANY_SLUG_RENAMES.get("b-rkert-werke-gmbh-co-kg"), "burkert-werke-gmbh-co-kg");
  const after = new Set(COMPANY_SLUG_RENAMES.values());
  for (const [from, to] of COMPANY_SLUG_RENAMES) {
    const url = new URL(`${COM}/company/${from}?x=1`);
    assert.equal(redirectTarget(url, url.host, COM, (s) => after.has(s)), `${COM}/company/${to}?x=1`);
    const live = new URL(`${COM}/company/${to}`);
    assert.equal(redirectTarget(live, live.host, COM, (s) => after.has(s)), null);
  }
});

test("canonical-slug renames: before the rebuild old URLs stay live, new ones hop back", () => {
  const before = (s: string) => s === "et-reo";
  const old = new URL(`${COM}/company/et-reo`);
  assert.equal(redirectTarget(old, old.host, COM, before), null);
  const fresh = new URL(`${COM}/company/etereo`);
  assert.equal(redirectTarget(fresh, fresh.host, COM, before), `${COM}/company/et-reo`);
  const unrelated = new URL(`${COM}/company/nope`);
  assert.equal(redirectTarget(unrelated, unrelated.host, COM, before), null);
});

test("prototype names are never treated as slugs to redirect", () => {
  for (const slug of ["constructor", "__proto__", "hasownproperty", "tostring"]) {
    const url = new URL(`${COM}/company/${slug}`);
    assert.equal(redirectTarget(url, url.host, COM, () => true), null);
    assert.equal(redirectTarget(url, url.host, COM, () => false), null);
  }
});

test("after the catalog rebuild every renamed old slug 308s to the new slug (never new -> old)", async () => {
  const catalog = (await import("../data/catalog.json", { with: { type: "json" } })).default as {
    index: { slug: string }[];
  };
  const { COMPANY_SLUG_RENAMES, companyRenameTarget } = await import("./redirects.ts");
  const slugs = new Set(catalog.index.map((r) => r.slug));
  const exists = (s: string) => slugs.has(s);
  let checked = 0;
  for (const [oldSlug, newSlug] of COMPANY_SLUG_RENAMES) {
    if (!slugs.has(newSlug)) continue;
    assert.equal(slugs.has(oldSlug), false, `${oldSlug} still in catalog`);
    assert.equal(companyRenameTarget(`/company/${oldSlug}`, exists), `/company/${newSlug}`);
    assert.equal(companyRenameTarget(`/company/${newSlug}`, exists), null);
    checked++;
  }
  assert.ok(checked >= 7, `only ${checked} renames checked`);
  const hop = redirectTarget(new URL("https://x.test/company/oinsmania"), "x.test", "https://x.test", exists);
  assert.equal(hop, "https://x.test/company/coinsmania");
});
