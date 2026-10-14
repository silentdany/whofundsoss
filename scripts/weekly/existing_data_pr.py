"""Find an existing weekly data PR for a given date (open or merged).

Used by the weekly-scraper workflow to skip a run when the data PR for that
date already exists (e.g. a late cron after a manual dispatch). Closed,
unmerged PRs do not count: they were rejected and a re-run is legitimate.

Also skips when data/weekly/<date>.json is already on main (--on-main, set by
the workflow from the contents API).

Input: JSON from
  gh pr list --state all --search "head:data/weekly-" \
    --json number,url,state,headRefName,files
Prints the first matching PR URL and exits 0 when one exists; exits 1 otherwise.
"""
from __future__ import annotations

import json
import re
import sys

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def find_existing(prs: list[dict], date: str) -> dict | None:
    """First open/merged PR that carries this date's data.

    Matches a head branch starting with data/weekly-<date> or
    data/weekly-run-<date>, or any data/weekly-* head that touches
    data/weekly/<date>.json (bot branches are data/weekly-run-<run id>).
    """
    if not _DATE_RE.match(date or ""):
        raise ValueError("date must be YYYY-MM-DD")
    target = f"data/weekly/{date}.json"
    by_name = (f"data/weekly-{date}", f"data/weekly-run-{date}")
    for pr in prs:
        head = pr.get("headRefName") or ""
        if not head.startswith("data/weekly-"):
            continue
        state = (pr.get("state") or "").upper()
        if state not in {"OPEN", "MERGED"}:
            continue
        if head.startswith(by_name):
            return pr
        paths = {f.get("path") for f in (pr.get("files") or []) if isinstance(f, dict)}
        if target in paths:
            return pr
    return None


def main(argv: list[str]) -> int:
    on_main = "--on-main" in argv
    argv = [a for a in argv if a != "--on-main"]
    if len(argv) != 2:
        print("usage: existing_data_pr.py YYYY-MM-DD [--on-main] < prs.json", file=sys.stderr)
        return 2
    if not _DATE_RE.match(argv[1]):
        print("date must be YYYY-MM-DD", file=sys.stderr)
        return 2
    if on_main:
        # data/weekly/<date>.json already exists on main (checked by the caller).
        print(f"main:data/weekly/{argv[1]}.json")
        return 0
    prs = json.load(sys.stdin)
    hit = find_existing(prs if isinstance(prs, list) else [], argv[1])
    if hit:
        print(hit.get("url") or f"#{hit.get('number')}")
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
