import assert from "node:assert/strict";
import test from "node:test";
import { buildCsp, isPreviewEnv, posthogEuHost } from "./security-headers.ts";

const parse = (csp: string) =>
  Object.fromEntries(csp.split(";").map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k!, v]));

test("production CSP: no Vercel Live / Pusher, narrow img and script sources", () => {
  const p = parse(buildCsp({ preview: false }));
  const flat = Object.values(p).flat().join(" ");
  assert.ok(!flat.includes("vercel.live") && !flat.includes("pusher") && !flat.includes("vercel.com"));
  assert.deepEqual(p["img-src"], ["'self'", "data:", "blob:"]);
  assert.deepEqual(p["script-src"], ["'self'", "'unsafe-inline'", "https://grok.com/grok-app-builder/", "https://eu-assets.i.posthog.com"]);
  assert.deepEqual(p["frame-ancestors"], ["'self'", "https://grok.com", "https://*.grok.com"]);
  assert.deepEqual(p["frame-src"], ["'none'"]);
  assert.deepEqual(p["object-src"], ["'none'"]);
  assert.ok(!flat.includes("us.i.posthog.com") && !flat.includes("app.posthog.com"));
  for (const d of ["script-src", "connect-src", "img-src", "default-src"]) {
    assert.ok(!p[d]!.includes("https:") && !p[d]!.includes("*"), d);
  }
});

test("preview CSP adds Vercel Live only", () => {
  const prod = parse(buildCsp({ preview: false }));
  const prev = parse(buildCsp({ preview: true }));
  assert.ok(prev["script-src"]!.includes("https://vercel.live"));
  assert.ok(prev["connect-src"]!.includes("wss://ws-us3.pusher.com"));
  assert.deepEqual(prev["frame-ancestors"], prod["frame-ancestors"]);
});

test("environment detection", () => {
  assert.equal(isPreviewEnv("production"), false);
  for (const v of ["preview", "development", undefined]) assert.equal(isPreviewEnv(v), true);
});

test("PostHog host is always the EU cloud", () => {
  assert.equal(posthogEuHost("https://eu.i.posthog.com"), "https://eu.i.posthog.com");
  for (const v of [undefined, "", "https://us.i.posthog.com", "https://app.posthog.com", "http://eu.i.posthog.com", "nope"]) {
    assert.equal(posthogEuHost(v), "https://eu.i.posthog.com", String(v));
  }
});
