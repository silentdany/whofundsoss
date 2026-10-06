import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { buildMovementsFromSnaps, type SnapFile } from "./movements.ts";
import type { Meta } from "./types.ts";

const prev = JSON.parse(
  readFileSync(new URL("../data/snapshots/2026-10-05.json", import.meta.url), "utf8"),
) as SnapFile;
const curr = JSON.parse(
  readFileSync(new URL("../data/snapshots/2026-10-06.json", import.meta.url), "utf8"),
) as SnapFile;
const catalogRaw = readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8");
const catalog = JSON.parse(catalogRaw) as { meta: Meta & { note_triage?: string } };

test("buildMovementsFromSnaps diffs 2026-10-05 → 2026-10-06 with verifiable hashes", () => {
  const move = buildMovementsFromSnaps(prev, curr, catalog.meta);
  assert.equal(move.from.collectedAt, "2026-10-05");
  assert.equal(move.to.collectedAt, "2026-10-06");
  assert.match(move.from.hash, /^[a-f0-9]{64}$/);
  assert.match(move.to.hash, /^[a-f0-9]{64}$/);
  assert.equal(move.from.hash, prev.meta.hash);
  assert.equal(move.to.hash, curr.meta.hash);
  assert.equal(move.summary.deltaUsd, 522);
  assert.equal(move.summary.deltaCompanies, 2);
  assert.ok(move.summary.climbers >= 1);
  assert.ok(move.newCompanies.some((c) => c.slug === "tik-ninja"));
  assert.ok(move.newCompanies.some((c) => c.slug === "redreply"));
  assert.ok(move.unchangedLeaders.some((c) => c.slug === "posit-dev" && c.rank === 1));
  assert.ok(move.note.includes("not from weekly scraper"));
});

test("live catalog is 2026-10-06, no note_triage, hash bit-identical (P0-1 Soft Sécu + P0-3)", () => {
  assert.equal(catalog.meta.collectedAt, "2026-10-06");
  assert.equal(catalog.meta.previousCollectedAt, "2026-10-05");
  assert.equal(catalog.meta.previousHash, prev.meta.hash);
  assert.equal(catalog.meta.companies, curr.meta.companies);
  assert.equal(catalog.meta.publicUsdAll, curr.meta.publicUsdAll);
  assert.equal(catalog.meta.note_triage, undefined);
  // Soft Sécu: SHA-256 of canonical JSON (Python sort_keys + ensure_ascii) equals meta.hash
  const pyCode =
    "import json,hashlib,sys\n" +
    "d=json.load(sys.stdin)\n" +
    "h=d['meta'].pop('hash')\n" +
    "c=json.dumps(d,sort_keys=True,separators=(',',':')).encode()\n" +
    "print(h)\n" +
    "print(hashlib.sha256(c).hexdigest())\n";
  const py = spawnSync("python3", ["-c", pyCode], {
    input: catalogRaw,
    encoding: "utf8",
  });
  assert.equal(py.status, 0, py.stderr);
  const [stored, rehash] = py.stdout.trim().split("\n");
  assert.equal(stored, rehash);
});
