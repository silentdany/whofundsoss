import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { expandSlugs, hasSlugKey, normSlug, SLUG_RENAMED_FROM, SLUG_RENAMES, slugEquivalents } from "./slug-aliases.ts";
import { isSpamDenylisted, SPAM_DENYLIST } from "./spam-denylist.ts";

// Cases come from the data, not from hard-coded slugs: every rename whose old or
// new form is a denylist key (QA a94c4e9: oinsmania, ilmaiset-..., sm-l-n-...).
const RAW: Record<string, string> = JSON.parse(readFileSync(new URL("../data/slug-renames.json", import.meta.url), "utf8")).renames;
const DENIED_RENAMES = [...SLUG_RENAMES].filter(([o, n]) => Object.hasOwn(SPAM_DENYLIST, o) || Object.hasOwn(SPAM_DENYLIST, n));

test("the map mirrors slug-renames.json, normalized like Python (trim + lowercase)", () => {
  assert.equal(SLUG_RENAMES.size, Object.keys(RAW).length);
  for (const [o, n] of Object.entries(RAW)) assert.equal(SLUG_RENAMES.get(normSlug(o)), normSlug(n));
  assert.equal(SLUG_RENAMED_FROM.size, SLUG_RENAMES.size, "renames are one-to-one");
});

test("at least the three QA cases are denylisted renames", () => {
  assert.ok(DENIED_RENAMES.length >= 3, `found ${DENIED_RENAMES.length}`);
});

test("renamed denylist keys are filtered before (old) and after (new) a rebuild", () => {
  for (const [oldSlug, newSlug] of DENIED_RENAMES) {
    assert.equal(isSpamDenylisted(oldSlug), true, oldSlug);
    assert.equal(isSpamDenylisted(newSlug), true, newSlug);
  }
});

test("every rename resolves both ways, any casing", () => {
  for (const [oldSlug, newSlug] of SLUG_RENAMES) {
    assert.deepEqual(slugEquivalents(oldSlug), [oldSlug, newSlug]);
    assert.deepEqual(slugEquivalents(` ${newSlug.toUpperCase()} `), [newSlug, oldSlug]);
    assert.equal(hasSlugKey(new Set([oldSlug]), newSlug), true);
    assert.equal(hasSlugKey(new Set([newSlug]), oldSlug), true);
    assert.ok(expandSlugs([oldSlug]).has(newSlug));
  }
});

test("prototype keys never match", () => {
  for (const k of ["constructor", "__proto__", "tostring", "hasownproperty"]) {
    assert.deepEqual(slugEquivalents(k), [k]);
    assert.equal(isSpamDenylisted(k), false);
  }
});
