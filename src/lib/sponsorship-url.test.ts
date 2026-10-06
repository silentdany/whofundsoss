import assert from "node:assert/strict";
import test from "node:test";
import {
  formatSponsorshipProjectLabel,
  isNamedProjectSlug,
  projectAnchorId,
  sponsorshipSourceUrl,
} from "./sponsorship-url.ts";
import type { Sponsorship } from "./types.ts";

function line(partial: Partial<Sponsorship> & Pick<Sponsorship, "project" | "source">): Sponsorship {
  return {
    amountUsd: null,
    cumulative: false,
    visibility: "public",
    aggregate: false,
    ...partial,
  };
}

test("OC and GH named projects get outbound source URLs", () => {
  assert.equal(sponsorshipSourceUrl(line({ project: "webpack", source: "oc" })), "https://opencollective.com/webpack");
  assert.equal(sponsorshipSourceUrl(line({ project: "adamchainz", source: "gh" })), "https://github.com/sponsors/adamchainz");
});

test("aggregate OSP lines link to the members index; own has no project URL", () => {
  assert.equal(
    sponsorshipSourceUrl(line({ project: "(agrégé OSS)", source: "osp", aggregate: true })),
    "https://opensourcepledge.com/members",
  );
  assert.equal(sponsorshipSourceUrl(line({ project: "Acme OSS Fund", source: "own" })), null);
});

test("junk project names are not linked", () => {
  assert.equal(isNamedProjectSlug("(agrégé OSS — 160 devs)"), false);
  assert.equal(sponsorshipSourceUrl(line({ project: "(agrégé OSS — 160 devs)", source: "oc" })), null);
  assert.equal(projectAnchorId("Vue.js"), "vue-js");
});

test("aggregate FR dump labels become EN without em dash", () => {
  const en = formatSponsorshipProjectLabel(
    "(agrégé OSS — 160 devs × $4688/dev, rapport 2025)",
  );
  assert.equal(en, "Aggregated OSS, 160 devs × $4688/dev, 2025 report");
  assert.equal(en.includes("\u2014"), false);
  assert.equal(en.includes("agrégé"), false);
  assert.equal(en.includes("rapport"), false);
  assert.equal(formatSponsorshipProjectLabel("webpack"), "webpack");
});
