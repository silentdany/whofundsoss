import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CONSENT_STORAGE_KEY,
  readConsent,
  shouldLoadAnalytics,
  shouldShowBanner,
  writeConsent,
} from "./analytics-consent.ts";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

test("no stored answer, garbage, or blocked storage all read as unset", () => {
  assert.equal(readConsent(null), "unset");
  assert.equal(readConsent(memoryStorage()), "unset");
  const junk = memoryStorage();
  junk.setItem(CONSENT_STORAGE_KEY, "yes");
  assert.equal(readConsent(junk), "unset");
  const blocked = { getItem: () => { throw new Error("SecurityError"); } };
  assert.equal(readConsent(blocked), "unset");
});

test("a choice round-trips and can be withdrawn", () => {
  const s = memoryStorage();
  writeConsent(s, "granted");
  assert.equal(readConsent(s), "granted");
  writeConsent(s, "denied");
  assert.equal(readConsent(s), "denied");
  writeConsent(s, "unset");
  assert.equal(s.map.has(CONSENT_STORAGE_KEY), false);
});

test("analytics load only on an explicit yes with a configured project", () => {
  assert.equal(shouldLoadAnalytics("unset", "k", "h"), false);
  assert.equal(shouldLoadAnalytics("denied", "k", "h"), false);
  assert.equal(shouldLoadAnalytics("granted", undefined, "h"), false);
  assert.equal(shouldLoadAnalytics("granted", "k", undefined), false);
  assert.equal(shouldLoadAnalytics("granted", "k", "h"), true);
});

test("the banner shows only client-side, with no answer yet", () => {
  assert.equal(shouldShowBanner("pending", true), false);
  assert.equal(shouldShowBanner("unset", true), true);
  assert.equal(shouldShowBanner("granted", true), false);
  assert.equal(shouldShowBanner("denied", true), false);
  assert.equal(shouldShowBanner("unset", false), false);
});

test("PostHog is never started outside the consent gate", () => {
  const root = readFileSync(new URL("../routes/__root.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(root, /PostHogProvider|posthog\.init/);
  assert.match(root, /<ConsentedAnalytics /);
  const gate = readFileSync(new URL("../components/analytics-consent.tsx", import.meta.url), "utf8");
  assert.equal(gate.match(/posthog\.init\(/g)?.length, 1);
  assert.match(gate, /if \(shouldLoadAnalytics\(consent, apiKey, host\)\) \{\n\s+if \(!started\.current\) \{\n\s+posthog\.init\(/);
  assert.doesNotMatch(gate, /<PostHogProvider[^>]*apiKey/);
});
