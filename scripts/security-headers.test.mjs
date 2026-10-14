import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  assert.ok(p["style-src"].includes("https://fonts.googleapis.com"));
  assert.ok(p["font-src"].includes("https://fonts.gstatic.com"));
  assert.ok(p["connect-src"].includes("https://*.ingest.de.sentry.io"));
  for (const d of ["script-src", "connect-src", "default-src"]) {
    assert.ok(!p[d].includes("*") && !p[d].includes("https:"), `${d} is not a wildcard`);
  }
});
