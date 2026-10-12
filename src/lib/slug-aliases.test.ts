import { test } from "node:test";
import assert from "node:assert/strict";
import { hasSlugKey, slugEquivalents } from "./slug-aliases.ts";
import { isSpamDenylisted } from "./spam-denylist.ts";

// QA a94c4e9 P1: renamed spam must stay filtered before and after a catalog rebuild.
const CASES: [string, string][] = [
  ["oinsmania", "coinsmania"],
  ["ilmaiset-pitk-vetovihjeet", "ilmaiset-pitkavetovihjeet"],
  ["sm-l-n-uten-sikkerhet", "smalan-uten-sikkerhet"],
];

for (const [oldSlug, newSlug] of CASES) {
  test(`denylist: ${oldSlug} filtered before rebuild (old key) and after (${newSlug})`, () => {
    assert.equal(isSpamDenylisted(oldSlug), true);
    assert.equal(isSpamDenylisted(newSlug), true);
  });
  test(`slug sets (holds/exclusions/API): ${oldSlug} <-> ${newSlug} both directions`, () => {
    assert.deepEqual(slugEquivalents(oldSlug), [oldSlug, newSlug]);
    assert.deepEqual(slugEquivalents(newSlug), [newSlug, oldSlug]);
    assert.equal(hasSlugKey(new Set([oldSlug]), newSlug), true);
    assert.equal(hasSlugKey(new Set([newSlug]), oldSlug), true);
  });
}

test("unrenamed slugs are untouched", () => {
  assert.deepEqual(slugEquivalents("posit-dev"), ["posit-dev"]);
  assert.equal(isSpamDenylisted("posit-dev"), false);
  assert.equal(isSpamDenylisted("sxl-cn"), false);
});
