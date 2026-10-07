import { test } from "node:test";
import assert from "node:assert/strict";
import { redirectTarget, SLUG_REDIRECTS } from "./redirects.ts";

const VERCEL = "https://whofundsoss.vercel.app";
const COM = "https://whofundsoss.com";

test("each French slug 308s to its English slug on the same origin", () => {
  for (const [from, to] of Object.entries(SLUG_REDIRECTS)) {
    const url = new URL(`${VERCEL}${from}`);
    assert.equal(redirectTarget(url, url.host, VERCEL), `${VERCEL}${to}`);
  }
});

test("trailing slash, case and query are handled", () => {
  const url = new URL(`${VERCEL}/Classement/?source=oc`);
  assert.equal(redirectTarget(url, url.host, VERCEL), `${VERCEL}/ranking?source=oc`);
});

test("English paths and previews are left alone while SITE_URL is the vercel.app", () => {
  for (const path of ["/", "/ranking", "/company/posit-dev", "/robots.txt"]) {
    const url = new URL(`${VERCEL}${path}`);
    assert.equal(redirectTarget(url, url.host, VERCEL), null);
  }
  const preview = new URL("https://whofundsoss-abc-silentdanys-projects.vercel.app/ranking");
  assert.equal(redirectTarget(preview, preview.host, COM), null);
});

test("legacy vercel.app host hops to SITE_URL in one step, new slug included", () => {
  const url = new URL(`${VERCEL}/classement`);
  assert.equal(redirectTarget(url, url.host, COM), `${COM}/ranking`);
  const company = new URL(`${VERCEL}/company/posit-dev`);
  assert.equal(redirectTarget(company, company.host, COM), `${COM}/company/posit-dev`);
});

test("www goes to the apex", () => {
  const url = new URL("https://www.whofundsoss.com/methode");
  assert.equal(redirectTarget(url, url.host, COM), `${COM}/method`);
});

test("dropped catalog slug nx-by-nrwl 308s to nrwl", () => {
  const url = new URL(`${VERCEL}/company/nx-by-nrwl`);
  assert.equal(redirectTarget(url, url.host, VERCEL), `${VERCEL}/company/nrwl`);
  const withSlash = new URL(`${VERCEL}/company/nx-by-nrwl/`);
  assert.equal(redirectTarget(withSlash, withSlash.host, VERCEL), `${VERCEL}/company/nrwl`);
});

test("page paths are normalized to lowercase without a trailing slash, files and APIs are not", () => {
  const cases: [string, string | null][] = [
    ["/Ranking", `${VERCEL}/ranking`],
    ["/company/posit-dev/", `${VERCEL}/company/posit-dev`],
    ["/Company/Posit-Dev/?x=1", `${VERCEL}/company/posit-dev?x=1`],
    ["/", null],
    ["/api/v1/leaderboard", null],
    ["/og/company/posit-dev.jpg", null],
    ["/sitemap.xml", null],
    ["/manifest.webmanifest", null],
  ];
  for (const [path, expected] of cases) {
    const url = new URL(`${VERCEL}${path}`);
    assert.equal(redirectTarget(url, url.host, VERCEL), expected, path);
  }
});
