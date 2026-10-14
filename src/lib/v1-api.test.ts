import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createWindowLimiter, serveV1, API_KEY, V1_CACHE_CONTROL } from "./http.ts";
import { csvCell } from "./csv.ts";

const ok = () =>
  new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
const req = (key: string | null = API_KEY, ip = "1.2.3.4") =>
  new Request("https://x/api/v1/leaderboard", {
    headers: { ...(key ? { "x-api-key": key } : {}), "x-forwarded-for": ip },
  });

test("v1: 200 gets s-maxage + stale-while-revalidate and Vary on the key", async () => {
  const lim = { ip: createWindowLimiter(5, 60_000), key: createWindowLimiter(5, 60_000) };
  const res = await serveV1(req(), ok, lim);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), V1_CACHE_CONTROL);
  assert.match(V1_CACHE_CONTROL, /s-maxage=\d+/);
  assert.match(V1_CACHE_CONTROL, /stale-while-revalidate=\d+/);
  assert.equal(res.headers.get("vary"), "X-API-Key");
});

test("v1: 404 and 401 are never cached", async () => {
  const lim = { ip: createWindowLimiter(5, 60_000), key: createWindowLimiter(5, 60_000) };
  const nf = await serveV1(req(), () => new Response("{}", { status: 404 }), lim);
  assert.equal(nf.headers.get("cache-control"), "no-store");
  const bad = await serveV1(req("nope"), ok, lim);
  assert.equal(bad.status, 401);
  assert.equal(bad.headers.get("cache-control"), "no-store");
});

test("v1: per-IP limit returns 429 with Retry-After (bad keys count too)", async () => {
  const lim = { ip: createWindowLimiter(2, 60_000), key: createWindowLimiter(100, 60_000) };
  await serveV1(req("nope"), ok, lim);
  await serveV1(req(), ok, lim);
  const res = await serveV1(req(), ok, lim);
  assert.equal(res.status, 429);
  assert.ok(Number(res.headers.get("retry-after")) >= 1);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(
    (await serveV1(req(API_KEY, "5.6.7.8"), ok, lim)).status,
    200,
    "other IP unaffected",
  );
});

test("v1: per-key limit applies across IPs", async () => {
  const lim = { ip: createWindowLimiter(100, 60_000), key: createWindowLimiter(2, 60_000) };
  await serveV1(req(API_KEY, "a"), ok, lim);
  await serveV1(req(API_KEY, "b"), ok, lim);
  const res = await serveV1(req(API_KEY, "c"), ok, lim);
  assert.equal(res.status, 429);
  assert.ok(res.headers.get("retry-after"));
});

test("limiter window resets", () => {
  const l = createWindowLimiter(1, 1000);
  assert.equal(l.take("k", 0).allowed, true);
  const over = l.take("k", 10);
  assert.equal(over.allowed, false);
  assert.equal(over.retryAfterS, 1);
  assert.equal(l.take("k", 1000).allowed, true);
});

test("every /api/v1 route goes through serveV1", () => {
  const dir = new URL("../routes/api/v1/", import.meta.url).pathname;
  const files: string[] = [];
  const walk = (d: string) =>
    readdirSync(d).forEach((f) =>
      statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : files.push(join(d, f)),
    );
  walk(dir);
  assert.ok(files.length >= 10);
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    assert.match(src, /serveV1\(request/, f);
    assert.doesNotMatch(src, /authorize\(/, f);
  }
});

test("every v1 payload in catalog.server filters spam, holds and exclusions", () => {
  const src = readFileSync(new URL("./catalog.server.ts", import.meta.url), "utf8");
  const body = (name: string) => {
    const i = src.indexOf(`function ${name}(`);
    assert.ok(i >= 0, name);
    const j = src.indexOf("\nexport ", i + 1);
    return src.slice(i, j < 0 ? undefined : j);
  };
  for (const fn of ["leaderboardQuery", "companiesCsv", "sponsorshipsCsv"])
    assert.match(body(fn), /v1Rows\(\)/, fn);
  for (const fn of [
    "companyApi",
    "sponsorshipsQuery",
    "deltasPayload",
    "graphQuery",
    "watchlistApi",
  ])
    assert.match(body(fn), /isV1Hidden\(/, fn);
  assert.match(body("isV1Hidden"), /isSpamDenylisted\(slug\)/);
  assert.match(body("isV1Hidden"), /held\.has\(s\)/);
  assert.match(body("isV1Hidden"), /publicApi\.hidden\(s\)/);
  assert.doesNotMatch(body("companiesCsv"), /spam_denylisted/);
});

test("CSV: formula after spaces, NBSP, ideographic space or fullwidth sign is neutralized", () => {
  for (const v of [
    " =1+1",
    "  @SUM(1)",
    "\u00a0=HYPERLINK(1)",
    "\u3000+1",
    "\uff1dSUM(1)",
    " \uff0b1",
    "\uff20x",
    "\ufeff=1",
  ]) {
    assert.ok(csvCell(v).replace(/^"/, "").startsWith("'"), JSON.stringify(v));
  }
});

test("CSV: plain negative numbers are not prefixed, formulas that look numeric are", () => {
  for (const v of ["-12", "-12.5", "-1e3", -7, "0"]) assert.equal(csvCell(v), String(v));
  assert.ok(csvCell("-1+1").startsWith("'"));
  assert.ok(csvCell("-A1").startsWith("'"));
});
