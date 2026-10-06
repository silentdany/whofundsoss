import assert from "node:assert/strict";
import test from "node:test";
import { isNamedProjectSlug, projectAnchorId, sponsorshipSourceUrl } from "./sponsorship-url.ts";
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
