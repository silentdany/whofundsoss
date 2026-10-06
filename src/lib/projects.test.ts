import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { money } from "./format.ts";
import {
  PROJECT_SPONSOR_GATE,
  buildProjectIndex,
  companyLinkedProjects,
  companyNarrativeLead,
  copyHasForbidden,
  gatedProjects,
  isProjectPublished,
  projectDescription,
  projectLead,
  projectTitle,
  type CompanyDetailLike,
} from "./projects.ts";
import type { CompanyRow } from "./types.ts";

const catalog = JSON.parse(readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8")) as {
  index: CompanyRow[];
  details: Record<string, CompanyDetailLike>;
  meta: { collectedAt: string };
};

const index = buildProjectIndex(catalog.index, catalog.details);
const published = gatedProjects(index);
const publishedSlugs = new Set(published.map((p) => p.slug));

test("gate is ≥3 and zero published pages fall below it", () => {
  assert.equal(PROJECT_SPONSOR_GATE, 3);
  assert.ok(published.length >= 70, `expected ~80 gated projects, got ${published.length}`);
  for (const rec of published) {
    assert.ok(rec.sponsorCount >= PROJECT_SPONSOR_GATE, rec.slug);
  }
  for (const [slug, rec] of index) {
    if (rec.sponsorCount < PROJECT_SPONSOR_GATE) {
      assert.equal(isProjectPublished(rec), false, slug);
      assert.ok(!publishedSlugs.has(slug), slug);
    }
  }
});

test("webpack, mochajs, socketio are published with ≥3 sponsors", () => {
  for (const slug of ["webpack", "mochajs", "socketio"]) {
    const rec = index.get(slug);
    assert.ok(rec, slug);
    assert.ok(isProjectPublished(rec), slug);
    assert.ok(rec!.sponsorCount >= 3, `${slug} count ${rec!.sponsorCount}`);
  }
});

test("project copy slots match voice pack and have no forbidden tokens", () => {
  const webpack = index.get("webpack")!;
  const lead = projectLead("webpack", webpack.sponsorCount, money(webpack.publicUsdSum));
  assert.equal(projectTitle("webpack"), "Who funds webpack · public sponsors · WhoFundsOSS");
  assert.match(projectDescription("webpack", catalog.meta.collectedAt), /Nothing invented/);
  assert.equal(
    lead,
    `${webpack.sponsorCount} companies name webpack in this snapshot. Public dollars tied to the project: ${money(webpack.publicUsdSum)}. Hidden GitHub tiers stay at zero.`,
  );
  for (const text of [projectTitle("webpack"), projectDescription("webpack", catalog.meta.collectedAt), lead]) {
    assert.equal(copyHasForbidden(text), false, text);
  }
});

test("Posit narrative lead is ≤3 sentences with pledge/OC split", () => {
  const row = catalog.index.find((r) => r.slug === "posit-dev")!;
  const detail = catalog.details["posit-dev"]!;
  const sentences = companyNarrativeLead(row, detail, money);
  assert.ok(sentences.length >= 1 && sentences.length <= 3);
  const blob = sentences.join(" ");
  assert.match(blob, /Leads the public record at/);
  assert.match(blob, /Open Source Pledge/);
  assert.match(blob, /cumulative Open Collective/);
  assert.equal(copyHasForbidden(blob), false, blob);
  const linked = companyLinkedProjects(detail, publishedSlugs);
  assert.ok(linked.some((p) => p.slug === "webpack"));
  assert.ok(linked.some((p) => p.slug === "prettier"));
});
