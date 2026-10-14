import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { buildMovementsFromSnaps } from "./movements.ts";
import { parseWeekly, selectLatestTwo, weeklyToSnap } from "./weekly-snapshots.ts";
import type { Meta } from "./types.ts";

const meta = { collectedAt: "x", hash: "h" } as unknown as Meta;
const file = (date: string, companies: unknown[] = [{ slug: "a", name: "A", publicUsd: 10 }]) => ({
  date,
  runId: `run-${date}`,
  companies,
});
const loaderOf = (files: Record<string, unknown>) => async (w: string) => {
  if (!(w in files)) throw new Error("missing");
  const v = files[w];
  if (v instanceof Error) throw v;
  return v;
};

test("selects the two latest weeks regardless of listing order", async () => {
  const files = { "2026-09-28": file("2026-09-28"), "2026-10-12": file("2026-10-12"), "2026-10-06": file("2026-10-06") };
  const pair = await selectLatestTwo(["2026-09-28", "2026-10-12", "2026-10-06"], loaderOf(files));
  assert.equal(pair.status, "ok");
  if (pair.status !== "ok") return;
  assert.equal(pair.curr.week, "2026-10-12");
  assert.equal(pair.prev.week, "2026-10-06");
});

test("only one snapshot → insufficient, keeps the one", async () => {
  const pair = await selectLatestTwo(["2026-10-12"], loaderOf({ "2026-10-12": file("2026-10-12") }));
  assert.equal(pair.status, "insufficient");
  if (pair.status === "insufficient") assert.equal(pair.only?.week, "2026-10-12");
});

test("no snapshot → insufficient with nothing", async () => {
  const pair = await selectLatestTwo([], loaderOf({}));
  assert.deepEqual(pair, { status: "insufficient", only: null, skipped: [] });
});

test("malformed latest file is skipped and the next two valid weeks are used", async () => {
  const files = {
    "2026-10-19": { date: "2026-10-19", companies: "oops" },
    "2026-10-12": file("2026-10-12"),
    "2026-10-06": file("2026-10-06"),
  };
  const pair = await selectLatestTwo(Object.keys(files), loaderOf(files));
  assert.equal(pair.status, "ok");
  if (pair.status !== "ok") return;
  assert.deepEqual([pair.prev.week, pair.curr.week], ["2026-10-06", "2026-10-12"]);
  assert.deepEqual(pair.skipped, ["2026-10-19"]);
});

test("unreadable file, date mismatch, bad names and bad rows are malformed", async () => {
  assert.equal(parseWeekly("2026-10-12", null), null);
  assert.equal(parseWeekly("2026-10-12", []), null);
  assert.equal(parseWeekly("2026-10-12", file("2026-10-06")), null);
  assert.equal(parseWeekly("latest", file("latest")), null);
  assert.equal(parseWeekly("2026-10-12", file("2026-10-12", [])), null);
  assert.equal(parseWeekly("2026-10-12", file("2026-10-12", [{ name: "no slug" }])), null);
  const files = { "2026-10-12": new Error("bad json"), "2026-10-06": file("2026-10-06") };
  const pair = await selectLatestTwo(["2026-10-12", "2026-10-06", "README"], loaderOf(files));
  assert.equal(pair.status, "insufficient");
  if (pair.status === "insufficient") {
    assert.equal(pair.only?.week, "2026-10-06");
    assert.deepEqual(pair.skipped, ["2026-10-12"]);
  }
});

test("weeklyToSnap drops held/excluded/hidden rows and ranks by public USD", () => {
  const w = parseWeekly(
    "2026-10-12",
    {
      ...file("2026-10-12", [
        { slug: "big", name: "Big", publicUsd: 500 },
        { slug: "small", name: "Small", publicUsd: 5 },
        { slug: "zero", name: "Zero", publicUsd: null },
        { slug: "held", name: "Held", publicUsd: 900, hold: true },
        { slug: "noted", name: "Noted", publicUsd: 800 },
        { slug: "spam", name: "Spam", publicUsd: 700 },
      ]),
      excludedNoted: [{ slug: "noted" }],
    },
  )!;
  const snap = weeklyToSnap(w, (s) => s === "spam");
  assert.deepEqual(snap.index.map((r) => [r.slug, r.rank]), [["big", 1], ["small", 2], ["zero", null]]);
  assert.equal(snap.meta.collectedAt, "2026-10-12");
  assert.equal(snap.meta.publicUsdAll, 505);
});

test("real data/weekly: diff covers the two latest files on disk", async () => {
  const dir = new URL("../../data/weekly/", import.meta.url);
  const weeks = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 10));
  const pair = await selectLatestTwo(weeks, async (w) => JSON.parse(readFileSync(new URL(`${w}.json`, dir), "utf8")));
  const sorted = [...weeks].sort();
  if (sorted.length < 2) return assert.equal(pair.status, "insufficient");
  assert.equal(pair.status, "ok");
  if (pair.status !== "ok") return;
  assert.equal(pair.curr.week, sorted.at(-1));
  assert.equal(pair.prev.week, sorted.at(-2));
  const move = buildMovementsFromSnaps(weeklyToSnap(pair.prev), weeklyToSnap(pair.curr), meta);
  assert.equal(move.from.collectedAt, sorted.at(-2));
  assert.equal(move.to.collectedAt, sorted.at(-1));
});

import { buildWeeklyMovements, isRealWeek, pairToSnaps } from "./weekly-snapshots.ts";
import { SLUG_RENAMES, normSlug } from "./slug-aliases.ts";

const canonical = (s: string) => SLUG_RENAMES.get(normSlug(s)) ?? normSlug(s);

test("Sécu B1 / QA P1-1: held in current week, visible in previous → not 'gone', totals unskewed", () => {
  const prevW = parseWeekly("2026-10-06", file("2026-10-06", [
    { slug: "keep", name: "Keep", publicUsd: 100 },
    { slug: "n32-tech", name: "n32.tech", publicUsd: 10 },
    { slug: "proxidize", name: "Proxidize", publicUsd: 1500 },
  ]))!;
  const currW = parseWeekly("2026-10-12", {
    ...file("2026-10-12", [
      { slug: "keep", name: "Keep", publicUsd: 100 },
      { slug: "n32-tech", name: "n32.tech", publicUsd: 10, hold: { kind: "zero_reading" } },
      { slug: "proxidize", name: "Proxidize", publicUsd: 1500 },
    ]),
    diff: { held: [{ slug: "n32-tech" }, { slug: "proxidize" }], disappeared_sponsors: [] },
  })!;
  const move = buildWeeklyMovements(prevW, currW, meta);
  assert.deepEqual(move.leftCompanies, []);
  assert.deepEqual(move.fallers, []);
  assert.equal(move.summary.deltaUsd, 0);
  const raw = pairToSnaps(prevW, currW);
  assert.deepEqual(raw.prev.index.map((r) => r.slug), ["keep"]);
  assert.deepEqual(raw.curr.index.map((r) => r.slug), ["keep"]);
});

test("QA P1-2: renamed companies (stable-ID + catalog renames) are neither new nor gone", () => {
  const prevW = parseWeekly("2026-10-06", file("2026-10-06", [
    { slug: "unknown", name: "上线了", publicUsd: 50 },
    { slug: "b-rkert-werke-gmbh-co-kg", name: "Bürkert", publicUsd: 70 },
  ]))!;
  const currW = parseWeekly("2026-10-12", {
    ...file("2026-10-12", [
      { slug: "sxl-cn", name: "上线了", publicUsd: 60 },
      { slug: "burkert-werke-gmbh-co-kg", name: "Bürkert", publicUsd: 70 },
    ]),
    diff: { renamed: [{ from: "unknown", to: "sxl-cn" }], new_sponsors: [], disappeared_sponsors: [] },
  })!;
  const raw = pairToSnaps(prevW, currW, () => false, canonical);
  const move = buildWeeklyMovements(prevW, currW, meta, () => false, canonical);
  assert.deepEqual(raw.prev.index.map((r) => r.slug).sort(), ["burkert-werke-gmbh-co-kg", "sxl-cn"]);
  assert.deepEqual(move.newCompanies, []);
  assert.deepEqual(move.leftCompanies, []);
  assert.deepEqual(move.newTop200, []);
  assert.deepEqual(move.climbers.map((c) => [c.slug, c.deltaUsd]), [["sxl-cn", 10]]);
});

test("real data: page new/gone == scraper diff behind /api/movements (no restriction needed)", async () => {
  const dir = new URL("../../data/weekly/", import.meta.url);
  const weeks = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 10));
  const pair = await selectLatestTwo(weeks, async (w) => JSON.parse(readFileSync(new URL(`${w}.json`, dir), "utf8")));
  if (pair.status !== "ok") return;
  const { prev, curr } = pairToSnaps(pair.prev, pair.curr, () => false, canonical);
  const before = new Set(prev.index.map((r) => r.slug));
  const after = new Set(curr.index.map((r) => r.slug));
  const blocked = (s: string) => pair.curr.blocked.has(s) || pair.prev.blocked.has(s);
  const apiNew = pair.curr.newSlugs.map(canonical).filter((s) => !blocked(s)).sort();
  const apiGone = pair.curr.goneSlugs.map(canonical).filter((s) => !blocked(s)).sort();
  assert.deepEqual([...after].filter((s) => !before.has(s)).sort(), apiNew);
  assert.deepEqual([...before].filter((s) => !after.has(s)).sort(), apiGone);
  const move = buildWeeklyMovements(pair.prev, pair.curr, meta, () => false, canonical);
  assert.deepEqual(move.newCompanies.map((r) => r.slug).sort(), apiNew);
  assert.deepEqual(move.leftCompanies.map((r) => r.slug).sort(), apiGone);
  for (const s of ["n32-tech", "proxidize"]) {
    assert.ok(!move.leftCompanies.some((r) => r.slug === s), `${s} must not be listed as gone`);
  }
});

test("impossible dates are rejected and reported", async () => {
  assert.equal(isRealWeek("2026-13-99"), false);
  assert.equal(isRealWeek("2026-02-30"), false);
  assert.equal(isRealWeek("2026-10-12"), true);
  const files = { "2026-13-99": file("2026-13-99"), "2026-10-12": file("2026-10-12"), "2026-10-06": file("2026-10-06") };
  const pair = await selectLatestTwo(Object.keys(files), loaderOf(files));
  assert.equal(pair.status, "ok");
  if (pair.status === "ok") {
    assert.equal(pair.curr.week, "2026-10-12");
    assert.deepEqual(pair.skipped, ["2026-13-99"]);
  }
});

test("negative or string publicUsd rows are skipped with a warning", () => {
  const w = parseWeekly("2026-10-12", file("2026-10-12", [
    { slug: "ok", publicUsd: 5 },
    { slug: "neg", publicUsd: -5 },
    { slug: "str", publicUsd: "100" },
    { slug: "nul", publicUsd: null },
  ]))!;
  assert.deepEqual(w.companies.map((c) => c.slug), ["ok", "nul"]);
  assert.equal(w.warnings.length, 2);
});

test("off-cycle snapshots are never selected as an official week", async () => {
  const files = { "2026-10-14": { ...file("2026-10-14"), offCycle: true }, "2026-10-12": file("2026-10-12"), "2026-10-06": file("2026-10-06") };
  const pair = await selectLatestTwo(Object.keys(files), loaderOf(files));
  assert.equal(pair.status, "ok");
  if (pair.status === "ok") assert.deepEqual([pair.prev.week, pair.curr.week], ["2026-10-06", "2026-10-12"]);
});

import { buildSnapshotsCsv, isOffCycle, officialWeeksFrom } from "./weekly-snapshots.ts";

test("offCycle accepts boolean true and string \"true\" only", async () => {
  assert.equal(isOffCycle(true), true);
  assert.equal(isOffCycle("true"), true);
  for (const v of [false, "false", "TRUE", 1, "1", null, undefined]) assert.equal(isOffCycle(v), false);
  const files = {
    "2026-10-15": { ...file("2026-10-15"), offCycle: "true" },
    "2026-10-14": { ...file("2026-10-14"), offCycle: true },
    "2026-10-12": file("2026-10-12"),
    "2026-10-06": file("2026-10-06"),
  };
  const pair = await selectLatestTwo(Object.keys(files), loaderOf(files));
  assert.equal(pair.status, "ok");
  if (pair.status === "ok") assert.deepEqual([pair.prev.week, pair.curr.week], ["2026-10-06", "2026-10-12"]);
});

test("available weeks never list off-cycle, invalid or unreadable weeks", async () => {
  const files = {
    "2026-10-15": { ...file("2026-10-15"), offCycle: "true" },
    "2026-10-14": { ...file("2026-10-14"), offCycle: true },
    "2026-10-12": file("2026-10-12"),
    "2026-10-07": new Error("unreadable"),
    "2026-10-06": file("2026-10-06"),
  };
  const weeks = await officialWeeksFrom([...Object.keys(files), "2026-13-99"], loaderOf(files));
  assert.deepEqual(weeks, ["2026-10-12", "2026-10-06"]);
});

test("snapshots CSV comes from the weekly files (oldest first, off-cycle excluded, filtered)", async () => {
  const files = {
    "2026-10-06": file("2026-10-06", [
      { slug: "a", publicUsd: 10, collectives: ["x", "y"], beneficiaries: [{}] },
      { slug: "spam", publicUsd: 99 },
    ]),
    "2026-10-12": { ...file("2026-10-12", [{ slug: "a", publicUsd: 12, collectives: ["x"] }]), runId: 42 },
    "2026-10-14": { ...file("2026-10-14"), offCycle: true },
  };
  const csv = await buildSnapshotsCsv(Object.keys(files), loaderOf(files), (s) => s === "spam");
  assert.deepEqual(csv.split("\n"), [
    "collected_at,hash,companies,sponsorships,ranked,public_usd_ranked,public_usd_all",
    "2026-10-06,run-2026-10-06,1,3,1,10,10",
    "2026-10-12,42,1,1,1,12,12",
  ]);
});

test("real data: snapshots CSV has one row per official weekly file", async () => {
  const dir = new URL("../../data/weekly/", import.meta.url);
  const weeks = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 10));
  const load = async (w: string) => JSON.parse(readFileSync(new URL(`${w}.json`, dir), "utf8"));
  const official = await officialWeeksFrom(weeks, load);
  const rows = (await buildSnapshotsCsv(weeks, load)).split("\n").slice(1);
  assert.deepEqual(rows.map((r) => r.split(",")[0]), [...official].sort());
});
