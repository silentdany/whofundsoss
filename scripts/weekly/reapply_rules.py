#!/usr/bin/env python3
"""Re-apply the post-scrape publication rules to an already written weekly file.

Used when a rule changes after a run (no re-scrape): applies, in order,
  1. slug renames (src/data/slug-renames.json) on company slugs, old -> new,
     when the rebuilt catalog uses the new slug;
  2. site overrides (data/overrides/site-overrides.json);
  3. the sharp-drop confirmation rule against the baseline weekly file;
then recomputes diff counts and re-renders the .md. Idempotent.

  python3 -m scripts.weekly.reapply_rules data/weekly/2026-10-12.json data/weekly/2026-10-06.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from scripts.weekly.diff import (
    DiffResult,
    apply_drop_confirmation,
    apply_site_overrides,
    load_site_overrides,
)
from scripts.weekly.denylist import parse_spam_denylist
from scripts.weekly.report import render_markdown

ROOT = Path(__file__).resolve().parents[2]
LIST_KEYS = ("new_sponsors", "disappeared_sponsors", "unverified_partial", "new_sponsorships",
             "amount_changes", "beneficiary_changes", "held")


def main(argv: list[str]) -> int:
    path, base_path = Path(argv[0]), Path(argv[1])
    payload = json.loads(path.read_text(encoding="utf-8"))
    baseline = json.loads(base_path.read_text(encoding="utf-8"))["companies"]
    companies = payload["companies"]

    renames = json.loads((ROOT / "src/data/slug-renames.json").read_text(encoding="utf-8"))["renames"]
    catalog = {r["slug"] for r in json.loads((ROOT / "src/data/catalog.json").read_text(encoding="utf-8"))["index"]}
    for c in companies:
        new = renames.get(c.get("slug"))
        if new and new in catalog and c["slug"] not in catalog:
            c["slug"] = new
    for e in payload.get("excludedNoted") or []:
        new = renames.get(e.get("slug"))
        if new and new in catalog:
            e["slug"] = new

    apply_site_overrides(companies, load_site_overrides())

    version, dl = parse_spam_denylist()
    payload["denylist"] = {**(payload.get("denylist") or {}), "version": version, "count": len(dl)}

    d = payload["diff"]
    diff = DiffResult(baseline_kind=d.get("baseline_kind"), baseline_path=d.get("baseline_path"))
    for k in LIST_KEYS:
        setattr(diff, k, list(d.get(k) or []))
    already = {(r.get("slug"), r.get("hold_kind")) for r in diff.held}
    held_before = len(diff.held)
    apply_drop_confirmation(
        diff, companies, baseline, run_date=payload["date"], off_cycle=bool(payload.get("offCycle"))
    )
    new_held = [r for r in diff.held[held_before:] if (r.get("slug"), r.get("hold_kind")) not in already]
    diff.held = diff.held[:held_before] + new_held
    for k in LIST_KEYS:
        d[k] = getattr(diff, k)
        d.setdefault("counts", {})[k] = len(d[k])

    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    path.with_suffix(".md").write_text(render_markdown(payload), encoding="utf-8")
    print(f"rewrote {path} and {path.with_suffix('.md')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
