import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { activeHolds, isHeld, parseHolds, withoutHeld } from "./holds.ts";
import { buildProjectIndex } from "./projects.ts";
import { sitemapPaths } from "./indexing.ts";

const liveHolds = parseHolds(readFileSync(new URL("../../data/holds/weekly-holds.csv", import.meta.url), "utf8"));
const catalog = JSON.parse(readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"));

test("review_on: held before, visible from that day; bad date fails closed", () => {
  const h = parseHolds("slug,review_on\nopenai,2026-10-19\nbad,soon\n");
  assert.equal(isHeld(h, "openai", "2026-10-18"), true);
  assert.equal(isHeld(h, "openai", "2026-10-19"), false);
  assert.equal(isHeld(h, "bad", "2099-01-01"), true);
  assert.equal(isHeld(h, "vercel", "2026-10-12"), false);
});

test("site: a held company leaves no trace in the catalog view (page, lists, graph, projects, sitemap)", () => {
  const review = liveHolds.get("openai")!;
  assert.ok(catalog.index.some((r: { slug: string }) => r.slug === "openai"), "fixture: openai is in the raw catalog");
  const held = activeHolds(liveHolds, "2026-10-12");
  assert.ok(held.has("openai"));
  const v = withoutHeld(catalog, held);
  assert.ok(!v.index.some((r: { slug: string }) => r.slug === "openai"), "no ranking/list row");
  assert.equal(v.details.openai, undefined, "company page has no detail, so /company/openai is a 404");
  assert.ok(!JSON.stringify(v.alliances).includes('"openai"'));
  assert.ok(!JSON.stringify(v.commons).includes('"openai"'));
  assert.ok(!JSON.stringify(v.watchlist).includes('"openai"'));
  for (const p of buildProjectIndex(v.index, v.details).values()) {
    assert.ok(!p.sponsors.some((s) => s.companySlug === "openai"), p.slug);
  }
  assert.ok(!sitemapPaths(v.index, v.details).includes("/company/openai"));
  // Expired: back everywhere.
  const after = withoutHeld(catalog, activeHolds(liveHolds, review));
  assert.ok(after.index.some((r: { slug: string }) => r.slug === "openai"));
});
