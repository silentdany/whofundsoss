import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CONSENT_STORAGE_KEY,
  clearPostHogStorage,
  consentExpired,
  isPostHogKey,
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

test("no stored answer, garbage, undated legacy values, or blocked storage all read as unset", () => {
  assert.equal(readConsent(null), "unset");
  assert.equal(readConsent(memoryStorage()), "unset");
  for (const junk of ["yes", "granted", "{", '{"choice":"granted"}', '{"choice":"maybe","at":"2026-11-24T00:00:00Z"}']) {
    const s = memoryStorage();
    s.setItem(CONSENT_STORAGE_KEY, junk);
    assert.equal(readConsent(s), "unset", junk);
  }
  const blocked = { getItem: () => { throw new Error("SecurityError"); } };
  assert.equal(readConsent(blocked), "unset");
});

test("a choice round-trips with its date and can be withdrawn", () => {
  const s = memoryStorage();
  const now = new Date("2026-11-24T12:00:00Z");
  writeConsent(s, "granted", now);
  assert.deepEqual(JSON.parse(s.map.get(CONSENT_STORAGE_KEY)!), { choice: "granted", at: "2026-11-24T12:00:00.000Z" });
  assert.equal(readConsent(s, now), "granted");
  writeConsent(s, "denied", now);
  assert.equal(readConsent(s, now), "denied");
  writeConsent(s, "unset", now);
  assert.equal(s.map.has(CONSENT_STORAGE_KEY), false);
});

test("a choice expires after 6 months and the banner asks again", () => {
  for (const choice of ["granted", "denied"] as const) {
    const s = memoryStorage();
    writeConsent(s, choice, new Date("2026-11-24T12:00:00Z"));
    assert.equal(readConsent(s, new Date("2027-05-24T11:59:59Z")), choice, "one second before 6 months");
    assert.equal(readConsent(s, new Date("2027-05-24T12:00:00Z")), "unset", "exactly 6 months");
    assert.equal(shouldShowBanner(readConsent(s, new Date("2027-06-01T00:00:00Z")), true), true);
  }
  // Month-end: 31 Aug + 6 months rolls into March, never earlier than 6 months.
  assert.equal(consentExpired(new Date("2026-08-31T00:00:00Z"), new Date("2027-02-28T23:59:59Z")), false);
  // A date in the future (clock skew, tampering) is not trusted.
  const s = memoryStorage();
  writeConsent(s, "granted", new Date("2030-01-01T00:00:00Z"));
  assert.equal(readConsent(s, new Date("2026-11-24T12:00:00Z")), "unset");
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
  assert.match(gate, /disable_session_recording: true/);
});

function keyedStorage(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries));
  return {
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

test("turning analytics off deletes PostHog's identifier and keeps only the no markers", () => {
  const written: string[] = [];
  let jar = "ph_phc_x_posthog=%7B%22distinct_id%22%3A%22abc%22%7D; __vdpl=1; __ph_opt_in_out_phc_x=0";
  const doc = {
    get cookie() { return jar; },
    set cookie(v: string) {
      written.push(v);
      const name = v.split("=")[0];
      if (/Max-Age=0/.test(v)) jar = jar.split("; ").filter((c) => !c.startsWith(`${name}=`)).join("; ");
    },
  };
  const local = keyedStorage({
    ph_phc_x_posthog: '{"distinct_id":"abc"}',
    ph_debug: "true",
    __ph_opt_in_out_phc_x: "0",
    [CONSENT_STORAGE_KEY]: '{"choice":"denied","at":"2026-11-24T12:00:00.000Z"}',
    other: "kept",
  });
  const session = keyedStorage({ ph_phc_x_primary_window_exists: "true", ph_phc_x_posthog: "{}" });
  clearPostHogStorage(doc, "whofundsoss.com", [local, session, null]);
  assert.equal(jar, "__vdpl=1; __ph_opt_in_out_phc_x=0");
  assert.ok(written.some((c) => c.includes("domain=.whofundsoss.com")), "parent-domain cookie also cleared");
  assert.deepEqual([...local.map.keys()].sort(), ["__ph_opt_in_out_phc_x", CONSENT_STORAGE_KEY, "other"].sort());
  assert.equal(session.map.size, 0);
});

test("PostHog key matching", () => {
  for (const k of ["ph_phc_x_posthog", "ph_debug", "__ph_surveys", "ph_phc_x_primary_window_exists"]) assert.equal(isPostHogKey(k), true, k);
  for (const k of ["__ph_opt_in_out_phc_x", CONSENT_STORAGE_KEY, "graph_ph_", "phone"]) assert.equal(isPostHogKey(k), false, k);
});

test("off: reset runs before opt-out (reset clears the opt-out flag), then persistence stops", () => {
  const gate = readFileSync(new URL("../components/analytics-consent.tsx", import.meta.url), "utf8");
  const reset = gate.indexOf("posthog.reset(true)");
  const optOut = gate.indexOf("posthog.opt_out_capturing()");
  const stop = gate.indexOf("posthog.set_config({ disable_persistence: true })");
  assert.ok(reset > 0 && reset < optOut && optOut < stop, "order: reset, opt_out_capturing, disable_persistence");
  assert.match(gate, /clearPostHogStorage\(document, window\.location\.hostname/);
});
