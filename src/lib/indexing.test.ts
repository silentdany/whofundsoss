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
const NAMED_BY_CDP = ["uudetkasinot-com", "fire-stick-tricks", "buy-google-reviews", "socialboosting", "nettikasinot-media"];

test("denylist has the five slugs named by CdP, each with a reason", () => {
  for (const slug of NAMED_BY_CDP) assert.ok(isSpamDenylisted(slug), slug);
  for (const [slug, entry] of Object.entries(SPAM_DENYLIST)) {
    assert.ok(entry.reason.length > 3, `${slug} needs a reason`);
    assert.doesNotMatch(entry.reason, /\u2014/);
  }
});

test("every denylisted slug exists in the catalog (data unchanged, still listed)", () => {
  for (const slug of DENIED) assert.ok(bySlug.has(slug), `${slug} missing from catalog.json`);
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
  for (const slug of DENIED) {
    assert.equal(companyIndexable(bySlug.get(slug)!, catalog.details[slug]), false, slug);
  }
});

test("a normal company with public dollars stays indexable", () => {
  for (const slug of ["posit-dev", "getsentry", "microsoft"]) {
    assert.equal(companyIndexable(bySlug.get(slug)!, catalog.details[slug]), true, slug);
  }
});

test("sitemap excludes every denylisted slug and keeps static pages", () => {
  const paths = new Set(sitemapPaths(catalog.index, catalog.details));
  for (const slug of DENIED) assert.ok(!paths.has(`/company/${slug}`), slug);
  for (const path of ["/", "/ranking", "/method", "/company/posit-dev"]) assert.ok(paths.has(path), path);
  assert.ok(![...paths].some((p) => /^\/(classement|methode|mouvements|mysteres|graphe)$/.test(p)));
});
