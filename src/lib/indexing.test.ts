import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { companyIndexable, sitemapPaths, type CompanyDetail } from "./indexing.ts";
import { isSpamDenylisted, SPAM_DENYLIST } from "./spam-denylist.ts";
import type { CompanyRow } from "./types.ts";

const catalog = JSON.parse(readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8")) as {
  index: CompanyRow[];
  details: Record<string, CompanyDetail>;
};
const bySlug = new Map(catalog.index.map((row) => [row.slug, row]));
const DENIED = Object.keys(SPAM_DENYLIST);
const DENIED_IN_CATALOG = DENIED.filter((slug) => bySlug.has(slug));
const NAMED_BY_CDP = ["uudetkasinot-com", "fire-stick-tricks", "buy-google-reviews", "socialboosting", "nettikasinot-media"];

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

test("denylisted slugs stay in the ranking with their rank and dollars", () => {
  const ranked = catalog.index.filter((row) => row.rank != null);
  assert.equal(ranked.length, 200);
  for (const slug of NAMED_BY_CDP) {
    const row = bySlug.get(slug)!;
    assert.ok(row.rank != null, `${slug} should still be ranked`);
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
  for (const path of ["/", "/ranking", "/method", "/company/posit-dev", "/company/nrwl"]) assert.ok(paths.has(path), path);
  assert.ok(!paths.has("/company/nx-by-nrwl"));
  assert.ok(![...paths].some((p) => /^\/(classement|methode|mouvements|mysteres|graphe)$/.test(p)));
});

test("every QA-flagged slug kept in the denylist is tagged qa, rejected ones are absent", () => {
  for (const slug of ["cryptonewsz", "cryptomoonpress", "crypto-tracker", "seolead", "buycheaprdp", "hashtags-for-likes", "open-apk-file", "upgrow"]) {
    assert.equal(isSpamDenylisted(slug), false, slug);
  }
  assert.equal(Object.values(SPAM_DENYLIST).filter((entry) => entry.source === "qa").length, 32);
  assert.equal(Object.values(SPAM_DENYLIST).filter((entry) => entry.source === "data").length, 8);
});
