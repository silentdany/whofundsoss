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
