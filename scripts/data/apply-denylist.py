#!/usr/bin/env python3
"""Take spam-denylisted companies out of the ranking in the shipped data.

The raw dumps behind rebuild-from-dumps.py are not in the repo, so this script
works on what is: src/data/catalog.json and src/data/snapshots/*.json.

Rule (same as rebuild-from-dumps.py): the top 200 non-denylisted companies by
public dollars get a rank, ties broken by name. A denylisted company keeps its
row, its dollars and its page, but has no rank and is not counted in
publicUsdRanked.

Idempotent: running it twice gives the same files.
"""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "src/data/catalog.json"
SNAPS = ROOT / "src/data/snapshots"
DENYLIST = ROOT / "src/data/public-spam-denylist.json"
RANKED = 200


def denylisted_slugs() -> set[str]:
    data = json.loads(DENYLIST.read_text())
    return {entry["slug"] for entry in data["entries"]}


def rerank(index: list[dict], deny: set[str]) -> None:
    eligible = sorted(
        (row for row in index if row["slug"] not in deny),
        key=lambda row: (-float(row["publicUsd"] or 0), row["name"].lower()),
    )
    rank_of = {row["slug"]: i + 1 for i, row in enumerate(eligible[:RANKED])}
    for row in index:
        row["rank"] = rank_of.get(row["slug"])


def ranked_meta(meta: dict, index: list[dict]) -> None:
    meta["ranked"] = sum(1 for row in index if row["rank"])
    meta["publicUsdRanked"] = round(sum(row["publicUsd"] for row in index if row["rank"]), 2)


def digest(payload: dict) -> str:
    body = json.loads(json.dumps(payload))
    body["meta"].pop("hash", None)
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(canonical).hexdigest()


def main() -> None:
    deny = denylisted_slugs()

    snap_hashes = {}
    for path in sorted(SNAPS.glob("*.json")):
        snap = json.loads(path.read_text())
        rerank(snap["index"], deny)
        ranked_meta(snap["meta"], snap["index"])
        snap["meta"]["hash"] = digest(snap)
        snap_hashes[snap["meta"]["collectedAt"]] = snap["meta"]["hash"]
        path.write_text(json.dumps(snap, separators=(",", ":")))
        print(path.name, "ranked", snap["meta"]["ranked"], "usd", snap["meta"]["publicUsdRanked"])

    live = json.loads(CATALOG.read_text())
    rerank(live["index"], deny)
    ranked_meta(live["meta"], live["index"])
    live["meta"].pop("featuredSlug", None)
    live["meta"].pop("note_triage", None)
    prev = live["meta"].get("previousCollectedAt")
    if prev in snap_hashes:
        live["meta"]["previousHash"] = snap_hashes[prev]
    live["meta"]["hash"] = digest(live)
    CATALOG.write_text(json.dumps(live, separators=(",", ":")))
    print(
        "catalog ranked",
        live["meta"]["ranked"],
        "usd",
        live["meta"]["publicUsdRanked"],
        "hash",
        live["meta"]["hash"][:12],
    )


if __name__ == "__main__":
    main()
