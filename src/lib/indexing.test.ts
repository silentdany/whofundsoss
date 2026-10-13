import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { companyIndexable, sitemapPaths, type CompanyDetail } from "./indexing.ts";
import { buildProjectIndex, gatedProjects } from "./projects.ts";
import { isSpamDenylisted, SPAM_DENYLIST, SPAM_DENYLIST_VERSION } from "./spam-denylist.ts";
import type { CompanyRow } from "./types.ts";

const catalog = JSON.parse(readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8")) as {
  index: CompanyRow[];
  details: Record<string, CompanyDetail>;
};
const bySlug = new Map(catalog.index.map((row) => [row.slug, row]));
const DENIED = Object.keys(SPAM_DENYLIST);
const DENIED_IN_CATALOG = DENIED.filter((slug) => bySlug.has(slug));
const NAMED_BY_CDP = ["uudetkasinot-com", "fire-stick-tricks", "buy-google-reviews", "socialboosting", "nettikasinot-media"];


test("denylist public export version is 2026-10-12.5", () => {
  assert.equal(SPAM_DENYLIST_VERSION, "2026-10-12.5");
  assert.equal(Object.keys(SPAM_DENYLIST).length, 107);
  assert.equal(isSpamDenylisted("redreply"), false);
});

test("denylist has the five slugs named by CdP, each with a reason", () => {
  for (const slug of NAMED_BY_CDP) assert.ok(isSpamDenylisted(slug), slug);
  for (const [slug, entry] of Object.entries(SPAM_DENYLIST)) {
    assert.ok(entry.reason.length > 3, `${slug} needs a reason`);
    assert.doesNotMatch(entry.reason, /\u2014/);
  }
});

test("every denylisted slug that is in the catalog stays listed (data unchanged)", () => {
  // Data-triage additions may be weekly-only (not yet in catalog.json) — those are OK.
  assert.ok(DENIED_IN_CATALOG.length >= 90, "most denylist entries should still be catalog rows");
  for (const slug of DENIED_IN_CATALOG) assert.ok(bySlug.has(slug), `${slug} missing from catalog.json`);
});

test("2026-10-06 Data triage slugs are denylisted (source=data)", () => {
  for (const slug of ["baocasino", "bsc-news", "w-in-ua", "spin-paradise", "aviator", "writers-per-hour", "awisee", "awisee-agency"]) {
    assert.ok(isSpamDenylisted(slug), slug);
    assert.equal(SPAM_DENYLIST[slug]!.source, "data");
  }
});

test("denylisted slugs keep their row and dollars but never get a rank", () => {
  const ranked = catalog.index.filter((row) => row.rank != null);
  assert.equal(ranked.length, 200);
  for (const row of ranked) assert.equal(isSpamDenylisted(row.slug), false, `${row.slug} is denylisted but ranked`);
  for (const slug of NAMED_BY_CDP) {
    const row = bySlug.get(slug)!;
    assert.equal(row.rank, null, `${slug} should not be ranked`);
    assert.ok(row.publicUsd > 0);
  }
});

test("denylisted company pages are noindex", () => {
  for (const slug of DENIED_IN_CATALOG) {
    assert.equal(companyIndexable(bySlug.get(slug)!, catalog.details[slug]), false, slug);
  }
});

test("a normal company with public dollars stays indexable", () => {
  for (const slug of ["posit-dev", "getsentry", "microsoft", "nrwl", "sanity-io"]) {
    assert.equal(companyIndexable(bySlug.get(slug)!, catalog.details[slug]), true, slug);
  }
});

test("sitemap excludes every denylisted slug and keeps static pages", () => {
  const paths = new Set(sitemapPaths(catalog.index, catalog.details));
  for (const slug of DENIED) assert.ok(!paths.has(`/company/${slug}`), slug);
  for (const path of ["/", "/ranking", "/method", "/denylist", "/company/posit-dev", "/company/nrwl"]) assert.ok(paths.has(path), path);
  assert.ok(!paths.has("/company/nx-by-nrwl"));
  assert.ok(![...paths].some((p) => /^\/(classement|methode|mouvements|mysteres|graphe)$/.test(p)));
});

test("every QA-flagged slug kept in the denylist is tagged qa, rejected ones are absent", () => {
  for (const slug of ["cryptonewsz", "cryptomoonpress", "crypto-tracker", "seolead", "buycheaprdp", "hashtags-for-likes", "open-apk-file", "upgrow", "redreply"]) {
    assert.equal(isSpamDenylisted(slug), false, slug);
  }
  assert.equal(Object.values(SPAM_DENYLIST).filter((entry) => entry.source === "qa").length, 32);
  assert.equal(Object.values(SPAM_DENYLIST).filter((entry) => entry.source === "data").length, 16);
});

test("sxl-cn is not denylisted and is ranked (decision 2026-10-12.3)", () => {
  assert.equal(isSpamDenylisted("sxl-cn"), false);
  const row = bySlug.get("sxl-cn");
  assert.ok(row, "sxl-cn in catalog");
  assert.equal(typeof row!.rank, "number");
  const by = Object.values(SPAM_DENYLIST).filter((e) => e.category === "commercial-unrelated").length;
  assert.equal(by, 4);
  const pub = JSON.parse(readFileSync(new URL("../data/public-spam-denylist.json", import.meta.url), "utf8"));
  assert.equal(pub.version, SPAM_DENYLIST_VERSION);
  assert.equal(pub.counts.total, 107);
  assert.equal(pub.entries.length, 107);
  assert.equal(pub.counts.by_category["commercial-unrelated"], 4);
  assert.ok(!pub.entries.some((e: { slug: string }) => e.slug === "sxl-cn"));
  assert.ok(pub.reviewed_and_not_listed.some((e: { slug: string }) => e.slug === "sxl-cn"));
  const copy = readFileSync(new URL("../../public/denylist.json", import.meta.url), "utf8");
  assert.deepEqual(JSON.parse(copy), pub);
});

test("sitemap includes gated /project paths and never a sub-gate project", () => {
  const index = buildProjectIndex(catalog.index, catalog.details);
  const gated = gatedProjects(index);
  const projectPaths = gated.map((p) => `/project/${encodeURIComponent(p.slug)}`);
  const paths = new Set(sitemapPaths(catalog.index, catalog.details, projectPaths));
  assert.ok(paths.has("/project/webpack"));
  assert.ok(paths.has("/project/mochajs"));
  assert.ok(paths.has("/project/socketio"));
  for (const [slug, rec] of index) {
    if (rec.sponsorCount < 3) assert.ok(!paths.has(`/project/${slug}`), slug);
  }
});

test("thunderclap-it and thunderclap-com are denylisted and in the public copy", () => {
  const pub = JSON.parse(readFileSync(new URL("../data/public-spam-denylist.json", import.meta.url), "utf8"));
  for (const slug of ["thunderclap-it", "thunderclap-com"]) {
    assert.equal(isSpamDenylisted(slug), true, slug);
    assert.equal(SPAM_DENYLIST[slug]!.category, "fake-engagement", slug);
    assert.ok(pub.entries.some((e: { slug: string }) => e.slug === slug), slug);
  }
});
