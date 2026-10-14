import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const all = (vercel.headers ?? []).find((h) => h.source === "/(.*)");
const header = (key) => all?.headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

test("every response carries nosniff and referrer policy (vercel.json)", () => {
  assert.ok(all, "vercel.json headers for /(.*)");
  assert.equal(header("X-Content-Type-Options"), "nosniff");
  assert.equal(header("Referrer-Policy"), "strict-origin-when-cross-origin");
});

test("CSP is not in vercel.json (it is environment-dependent, set in src/start.ts)", () => {
  assert.equal(header("Content-Security-Policy"), undefined);
  const start = readFileSync(new URL("../src/start.ts", import.meta.url), "utf8");
  assert.match(start, /headers\.set\("content-security-policy", CSP\)/);
});
