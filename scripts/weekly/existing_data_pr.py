"""Find an existing weekly data PR for a given date (open or merged).

Used by the weekly-scraper workflow to skip a run when the data PR for that
date already exists (e.g. a late cron after a manual dispatch). Closed,
unmerged PRs do not count: they were rejected and a re-run is legitimate.

Input: JSON from
  gh pr list --state all --search "head:data/weekly-run-" \
    --json number,url,state,headRefName,files,mergedAt
Prints the first matching PR URL and exits 0 when one exists; exits 1 otherwise.
"""
from __future__ import annotations

import json
import re
import sys

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def find_existing(prs: list[dict], date: str) -> dict | None:
    if not _DATE_RE.match(date or ""):
        raise ValueError("date must be YYYY-MM-DD")
    target = f"data/weekly/{date}.json"
    for pr in prs:
        if not (pr.get("headRefName") or "").startswith("data/weekly-run-"):
            continue
        state = (pr.get("state") or "").upper()
        if state not in {"OPEN", "MERGED"}:
            continue
        paths = {f.get("path") for f in (pr.get("files") or []) if isinstance(f, dict)}
        if target in paths:
            return pr
    return None


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: existing_data_pr.py YYYY-MM-DD < prs.json", file=sys.stderr)
        return 2
    prs = json.load(sys.stdin)
    hit = find_existing(prs if isinstance(prs, list) else [], argv[1])
    if hit:
        print(hit.get("url") or f"#{hit.get('number')}")
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
