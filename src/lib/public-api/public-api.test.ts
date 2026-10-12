import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createPublicApi, exclusionSlugs, holdSlugs, NOT_AVAILABLE, normalizeDomain, parseGenericHosts, type CatalogLike, type WeeklyFile } from "./core.ts";
import { createRateLimiter, servePublicApi } from "./http.ts";
import type { CompanyRow, Sponsorship } from "../types.ts";

function row(slug: string, extra: Partial<CompanyRow> = {}): CompanyRow {
  return {
    slug, name: slug.toUpperCase(), site: `https://${slug}.example`, sector: null, rank: 1, publicUsd: 100,
    projects: 1, ghBeneficiaries: 0, sources: ["oc"], whale: false, transparency: 0.5, volume: 0.5,
    coverage: 0.5, projectsWithAmount: 1, unitemized: false, lowVolume: false, dedupedPledge: false, ...extra,
  };
}
const oc = (project: string, amountUsd: number): Sponsorship => ({ project, source: "oc", amountUsd, cumulative: true, visibility: "public", aggregate: false });
const ghPrivate = (project: string): Sponsorship => ({ project, source: "gh", amountUsd: null, cumulative: false, visibility: "hidden", aggregate: false });
// A hidden GH line that still carries a figure in the file must never leak it.
const ghLeaky = (project: string): Sponsorship => ({ project, source: "gh", amountUsd: 999, cumulative: false, visibility: "hidden", aggregate: false });

const SLUGS = ["acme", "beta", "gamma", "delta", "spamco", "excludedco", "heldco"];
const catalog: CatalogLike = {
  meta: { collectedAt: "2026-10-06", hash: "abcdef1234567890" },
  index: SLUGS.map((s) => row(s, s === "delta" ? { sources: ["gh"], publicUsd: 0 } : {})),
  details: Object.fromEntries(
    SLUGS.map((s) => [
      s,
      {
        bySource: { oc: s === "delta" ? 0 : 100, osp: 0, gh: s === "delta" ? 999 : 0, own: 0 },
        sponsorships: s === "delta" ? [ghPrivate("babel"), ghLeaky("vite")] : [oc("babel", 100), oc("vite", 10)],
      },
    ]),
  ),
};

function makeApi() {
  return createPublicApi({
    catalog,
    denylistVersion: "2026-10-12.1",
    spam: new Set(["spamco"]),
    excluded: exclusionSlugs("entreprise,login_github,site,exclusion_raison\nExcluded Inc,excludedco,https://x.example,spam_casino\n", catalog.index),
    held: holdSlugs("slug,source,reason,decided_by,since,review_on\nheldco,gh,\"single reading, keep last value\",CdP,2026-10-12,2026-10-19\n"),
    today: () => "2026-10-12",
    publicDenylist: { version: "2026-10-12.1", entries: [{ slug: "spamco" }] },
  });
}

const weekly: WeeklyFile = {
  date: "2026-10-12",
  denylist: { version: "2026-10-12.1" },
  companies: [
    { slug: "openai", hold: { kind: "manual" } },
    { slug: "casinoz", exclusionNote: "denylist:gambling:casino" },
  ],
  excludedNoted: [{ slug: "funrize-social-casino" }],
  diff: {
    new_sponsors: [
      { slug: "fresh", name: "Fresh", sources: ["oc"], publicUsd: 50 },
      { slug: "spamco", name: "Spam", sources: ["oc"], publicUsd: 1 },
      { slug: "casinoz", name: "Casinoz", sources: ["oc"], publicUsd: 1 },
      { slug: "funrize-social-casino", name: "Funrize", sources: ["oc"], publicUsd: 1 },
      { slug: "excludedco", name: "Excluded", sources: ["oc"], publicUsd: 1 },
    ],
    disappeared_sponsors: [{ slug: "gone", name: "Gone", sources: ["oc"], publicUsd: 5 }, { slug: "heldco", sources: ["gh"] }],
    held: [{ slug: "openai", name: "OpenAI", sources: ["gh"] }, { slug: "n32-tech", sources: ["gh"] }],
    amount_changes: [
      { slug: "acme", source: "oc", from: 1, to: 2, delta: 1 },
      { slug: "delta", source: "gh", from: 5, to: 9, delta: 4 },
    ],
    new_sponsorships: [{ sponsor: "openai", beneficiary: "x" }, { sponsor: "acme", beneficiary: "y" }],
    beneficiary_changes: [{ slug: "n32-tech", from: 1, to: 0 }, { slug: "acme", from: 1, to: 2 }],
  },
};

function assertEnvelope(body: any) {
  assert.equal(body.meta.api_version, "v1");
  assert.match(body.meta.snapshot_date, /^2026-10-(06|12)$/);
  assert.equal(body.meta.denylist_version, "2026-10-12.1");
  assert.ok(Array.isArray(body.meta.sources));
  for (const s of body.meta.sources) assert.match(s.name, /^(GitHub Sponsors|Open Collective|Open Source Pledge|Own program)$/);
}

test("every route includes source, snapshot date and denylist version", () => {
  const api = makeApi();
  for (const r of [
    api.listProjects(new URLSearchParams()),
    api.getProject("babel"),
    api.getSponsor("acme"),
    api.movements("2026-10-12", weekly, ["2026-10-12"]),
    api.denylist(),
  ]) {
    assert.equal(r.status, 200);
    assertEnvelope(r.body);
  }
  const p: any = api.getProject("babel").body;
  assert.deepEqual(p.meta.sources.map((s: any) => s.name), ["GitHub Sponsors", "Open Collective"]);
  for (const s of p.data.sponsors) assert.ok(s.source_name);
});

test("private GitHub amounts are null with a private marker", () => {
  const api = makeApi();
  const sponsor: any = api.getSponsor("delta").body;
  for (const s of sponsor.data.sponsorships) {
    assert.equal(s.source, "gh");
    assert.equal(s.amount_usd, null);
    assert.equal(s.private, true);
  }
  assert.deepEqual(sponsor.data.by_source.gh, { source: "GitHub Sponsors", amount_usd: null, private: true });
  const project: any = api.getProject("vite").body;
  const d = project.data.sponsors.find((s: any) => s.slug === "delta");
  assert.equal(d.amount_usd, null);
  assert.equal(d.private, true);
  assert.equal(project.data.public_usd, 30); // 999 never summed
  const mv: any = api.movements("2026-10-12", weekly, []).body;
  assert.ok(mv.data.amount_changes.every((r: any) => r.slug !== "delta"));
  for (const r of mv.data.new_sponsorships) assert.deepEqual([r.amount_usd, r.private], [null, true]);
  // Nothing anywhere carries the leaky 999 figure.
  for (const r of [api.getSponsor("delta"), api.getProject("vite"), api.listProjects(new URLSearchParams())]) {
    assert.doesNotMatch(JSON.stringify(r.body), /999/);
  }
});

test("hold entries are never exposed", () => {
  const api = makeApi();
  assert.equal(api.getSponsor("heldco").status, 404);
  const list: any = api.listProjects(new URLSearchParams({ sponsor: "heldco" })).body;
  assert.equal(list.data.length, 0);
  assert.ok(!JSON.stringify(api.getProject("babel").body).includes("heldco"));
  const mv = JSON.stringify(api.movements("2026-10-12", weekly, []).body);
  for (const slug of ["heldco", "openai", "n32-tech"]) assert.ok(!mv.includes(`"${slug}"`), slug);
});

test("excluded entries are never exposed", () => {
  const api = makeApi();
  assert.equal(api.getSponsor("excludedco").status, 404);
  assert.ok(!JSON.stringify(api.getProject("babel").body).includes("excludedco"));
  const mv = JSON.stringify(api.movements("2026-10-12", weekly, []).body);
  assert.ok(!mv.includes("excludedco"));
  assert.ok(!mv.includes("funrize-social-casino"));
});

test("spam is never exposed", () => {
  const api = makeApi();
  assert.equal(api.getSponsor("spamco").status, 404);
  assert.ok(!JSON.stringify(api.getProject("babel").body).includes("spamco"));
  assert.ok(!JSON.stringify(api.listProjects(new URLSearchParams({ q: "" })).body).includes("spamco"));
  const mv: any = api.movements("2026-10-12", weekly, []).body;
  assert.deepEqual(mv.data.new_sponsors.map((r: any) => r.slug), ["fresh"]);
  assert.ok(!JSON.stringify(mv).includes("casinoz"));
});

test("project gate counts only visible sponsors (3 minimum)", () => {
  const api = makeApi();
  const babel: any = api.getProject("babel").body;
  assert.deepEqual(babel.data.sponsors.map((s: any) => s.slug).sort(), ["acme", "beta", "delta", "gamma"]);
  const tiny = createPublicApi({
    catalog, denylistVersion: "v", spam: new Set(["acme", "spamco"]), excluded: new Set(["beta", "excludedco"]), held: new Set(["gamma", "heldco"]), publicDenylist: {},
  });
  assert.equal(tiny.getProject("babel").status, 404);
});

test("pagination and filters", () => {
  const api = makeApi();
  const r: any = api.listProjects(new URLSearchParams({ per_page: "1", page: "2" })).body;
  assert.deepEqual(r.pagination, { page: 2, per_page: 1, total: 2, total_pages: 2 });
  assert.equal(r.data.length, 1);
  assert.equal(api.listProjects(new URLSearchParams({ source: "bogus" })).status, 400);
  const gh: any = api.listProjects(new URLSearchParams({ source: "gh" })).body;
  assert.equal(gh.data.length, 2);
  const q: any = api.listProjects(new URLSearchParams({ q: "vit" })).body;
  assert.deepEqual(q.data.map((p: any) => p.slug), ["vite"]);
});

test("movements validates the week", () => {
  const api = makeApi();
  assert.equal(api.movements(null, null, ["2026-10-06"]).status, 400);
  assert.equal(api.movements("2026-13-99; drop", null, []).status, 400);
  const nf: any = api.movements("2026-01-05", null, ["2026-10-06"]);
  assert.equal(nf.status, 404);
  assert.deepEqual(nf.body.available_weeks, ["2026-10-06"]);
});

test("denylist reuses the public export", () => {
  const live = JSON.parse(readFileSync(new URL("../../data/public-spam-denylist.json", import.meta.url), "utf8"));
  const api = createPublicApi({ catalog, denylistVersion: live.version, spam: new Set(), excluded: new Set(), held: new Set(), publicDenylist: live });
  const r: any = api.denylist().body;
  assert.deepEqual(r.data, live);
  assert.equal(r.meta.denylist_version, live.version);
});

test("live data: holds and exclusions files parse to the expected slugs", () => {
  const holds = holdSlugs(readFileSync(new URL("../../../data/holds/weekly-holds.csv", import.meta.url), "utf8"));
  assert.ok(holds.has("openai"));
  const ex = exclusionSlugs(readFileSync(new URL("../../../data/exclusions/raw-exclusions.csv", import.meta.url), "utf8"), []);
  assert.ok(ex.has("oinsmania"));
  assert.ok(ex.has("supabase"));
  assert.ok(!ex.has("github"), "GitHub the company is not excluded (only GitHub Sponsors pass-through, by login github-sponsors)");
});

test("http: open CORS, read-only, cache headers, ETag, rate limit", async () => {
  const api = makeApi();
  const limiter = createRateLimiter(2, 60_000);
  const h = () => api.getSponsor("acme");
  const req = (method = "GET", headers: Record<string, string> = {}) =>
    new Request("https://whofundsoss.com/api/sponsors/acme", { method, headers: { "x-forwarded-for": "1.2.3.4", ...headers } });

  const pre = await servePublicApi(req("OPTIONS"), limiter, "t", h);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), "*");

  const post = await servePublicApi(req("POST"), limiter, "t", h);
  assert.equal(post.status, 405);

  const ok = await servePublicApi(req(), limiter, "t", h);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("access-control-allow-origin"), "*");
  assert.match(ok.headers.get("cache-control")!, /s-maxage=3600/);
  const etag = ok.headers.get("etag")!;
  assert.match(etag, /^W\/"t-/);

  const notModified = await servePublicApi(req("GET", { "if-none-match": etag }), limiter, "t", h);
  assert.equal(notModified.status, 304);

  const limited = await servePublicApi(req(), limiter, "t", h);
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
  assert.equal(limited.headers.get("cache-control"), "no-store");

  const other = await servePublicApi(new Request("https://x/api", { headers: { "x-forwarded-for": "5.6.7.8" } }), limiter, "t", h);
  assert.equal(other.status, 200);
});

test("rate limiter window resets", () => {
  const l = createRateLimiter(1, 1000);
  assert.equal(l.take("a", 0).allowed, true);
  assert.equal(l.take("a", 10).allowed, false);
  assert.equal(l.take("a", 1001).allowed, true);
});


test("hidden and unknown entries return the same neutral 404 with meta", () => {
  const api = makeApi();
  const bodies = ["spamco", "excludedco", "heldco", "does-not-exist"].map((slug) => {
    const r = api.getSponsor(slug);
    assert.equal(r.status, 404, slug);
    const b: any = r.body;
    assert.equal(b.error.message, NOT_AVAILABLE);
    assertEnvelope(b);
    return JSON.stringify(b);
  });
  assert.equal(new Set(bodies).size, 1, "hidden entries are indistinguishable from unknown ones");
  const p: any = api.getProject("nope").body;
  assert.equal(p.error.message, NOT_AVAILABLE);
});

test("400, 404 route and 429 responses carry the meta", async () => {
  const api = makeApi();
  assertEnvelope(api.listProjects(new URLSearchParams({ source: "bogus" })).body);
  assertEnvelope(api.movements(null, null, []).body);
  assertEnvelope(api.movements("2026-01-05", null, []).body);
  const route: any = api.notFoundRoute("/api/nope");
  assert.equal(route.status, 404);
  assertEnvelope(route.body);
  const limiter = createRateLimiter(0, 60_000);
  const r = await servePublicApi(new Request("https://x/api/denylist"), limiter, "t", () => api.denylist(), api.error);
  assert.equal(r.status, 429);
  assertEnvelope(await r.json());
  const post = await servePublicApi(new Request("https://x/api/denylist", { method: "POST" }), createRateLimiter(), "t", () => api.denylist(), api.error);
  assert.equal(post.status, 405);
  assertEnvelope(await post.json());
});

test("holds respect review_on: hidden while active, back once expired", () => {
  const csv = "slug,source,reason,decided_by,since,review_on\nheldco,gh,x,CdP,2026-10-12,2026-10-19\nbadco,gh,x,CdP,2026-10-12,not-a-date\n";
  const held = holdSlugs(csv);
  assert.equal(held.get("heldco"), "2026-10-19");
  assert.equal(held.get("badco"), "", "malformed review_on fails closed (stays hidden)");
  let day = "2026-10-18";
  const api = createPublicApi({ catalog, denylistVersion: "v", spam: new Set(), excluded: new Set(), held, today: () => day, publicDenylist: {} });
  assert.equal(api.getSponsor("heldco").status, 404);
  assert.ok(!JSON.stringify(api.getProject("babel").body).includes("heldco"));
  day = "2026-10-19";
  assert.equal(api.getSponsor("heldco").status, 200);
  assert.ok(JSON.stringify(api.getProject("babel").body).includes("heldco"));
});

test("live holds file: openai is held until its review_on", () => {
  const held = holdSlugs(readFileSync(new URL("../../../data/holds/weekly-holds.csv", import.meta.url), "utf8"));
  assert.match(held.get("openai") ?? "", /^\d{4}-\d{2}-\d{2}$/);
});

test("exclusions also match by exact domain, never by a generic host", () => {
  const generic = parseGenericHosts(readFileSync(new URL("../../../scripts/weekly/generic_hosts.py", import.meta.url), "utf8"));
  assert.ok(generic.has("github.com") && generic.has("reddit.com") && generic.has("opencollective.com"));
  assert.equal(normalizeDomain("https://www.Thunderclap.it/buy?x=1", generic), "thunderclap.it");
  assert.equal(normalizeDomain("https://github.com/sponsors/", generic), null);
  const rows = [
    { slug: "thunderclap-it", name: "Thunderclap", site: "https://thunderclap.it" },
    { slug: "github", name: "GitHub", site: "https://github.com" },
    { slug: "acme", name: "Acme", site: "https://acme.example" },
  ];
  const csv = "entreprise,login_github,site,exclusion_raison\nBuy Instagram Followers Thunderclapit,,https://www.thunderclap.it/,spam_followers\nGitHub Sponsors,github-sponsors,https://github.com/sponsors/,platform_pass_through\n";
  const ex = exclusionSlugs(csv, rows, generic);
  assert.ok(ex.has("thunderclap-it"));
  assert.ok(!ex.has("github"));
  assert.ok(!ex.has("acme"));
});

test("live data: thunderclap-it is excluded, GitHub the company is not", () => {
  const live = JSON.parse(readFileSync(new URL("../../data/catalog.json", import.meta.url), "utf8"));
  const generic = parseGenericHosts(readFileSync(new URL("../../../scripts/weekly/generic_hosts.py", import.meta.url), "utf8"));
  const ex = exclusionSlugs(readFileSync(new URL("../../../data/exclusions/raw-exclusions.csv", import.meta.url), "utf8"), live.index, generic);
  assert.ok(ex.has("thunderclap-it"));
  assert.ok(!ex.has("github"));
  assert.ok(!ex.has("getsentry"));
});

test("movements snapshot_date is the requested week; denylist lists sources", () => {
  const api = makeApi();
  const mv: any = api.movements("2026-10-12", weekly, []).body;
  assert.equal(mv.meta.snapshot_date, "2026-10-12");
  assert.equal(mv.meta.snapshot_kind, "weekly");
  assert.equal(mv.meta.catalog_snapshot_date, "2026-10-06");
  const dl: any = api.denylist().body;
  assert.ok(dl.meta.sources.length > 0);
});
