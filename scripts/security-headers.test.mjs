import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const all = (vercel.headers ?? []).find((h) => h.source === "/(.*)");
const header = (key) => all?.headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;
const csp = () =>
  Object.fromEntries(
    header("Content-Security-Policy")
      .split(";")
      .map((d) => d.trim().split(/\s+/))
      .map(([name, ...values]) => [name, values]),
  );

test("every response carries nosniff, referrer policy and a CSP", () => {
  assert.ok(all, "vercel.json headers for /(.*)");
  assert.equal(header("X-Content-Type-Options"), "nosniff");
  assert.equal(header("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.ok(header("Content-Security-Policy"));
});

test("CSP locks framing to the site and the Grok embedder only", () => {
  assert.deepEqual(csp()["frame-ancestors"], ["'self'", "https://grok.com", "https://*.grok.com"]);
});

test("CSP allows the third parties the site really loads, and nothing broad", () => {
  const p = csp();
  assert.deepEqual(p["default-src"], ["'self'"]);
  assert.deepEqual(p["object-src"], ["'none'"]);
  // AGENTS.md rule 2: the Grok branding script must not be blocked.
  assert.ok(p["script-src"].includes("https://grok.com"));
  // Fonts are self-hosted (public/fonts): Google is not allowed to load anything.
  for (const d of Object.keys(p)) assert.ok(!p[d].some((src) => /fonts\.(googleapis|gstatic)\.com/.test(src)), d);
  assert.ok(p["connect-src"].includes("https://*.ingest.de.sentry.io"));
  // PostHog (EU) analytics bundled in the client.
  assert.ok(p["script-src"].includes("https://eu-assets.i.posthog.com"));
  assert.ok(p["connect-src"].includes("https://eu.i.posthog.com"));
  for (const d of ["script-src", "connect-src", "default-src"]) {
    assert.ok(!p[d].includes("*") && !p[d].includes("https:"), `${d} is not a wildcard`);
  }
});

test("fonts are self-hosted with their OFL licenses, no Google Fonts link", () => {
  const root = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.doesNotMatch(root + css, /fonts\.(googleapis|gstatic)\.com/);
  for (const url of css.matchAll(/url\("(\/fonts\/[^"]+)"\)/g)) {
    assert.ok(existsSync(new URL(`../public${url[1]}`, import.meta.url)), url[1]);
  }
  for (const name of ["Fraunces", "Manrope"]) {
    const license = readFileSync(new URL(`../public/fonts/${name}-OFL.txt`, import.meta.url), "utf8");
    assert.match(license, /SIL Open Font License, Version 1\.1/);
  }
});
