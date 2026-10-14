"""Find an existing weekly data PR for a given date (open or merged).

Used by the weekly-scraper workflow to skip a run when the data PR for that
date already exists (e.g. a late cron after a manual dispatch). Closed,
unmerged PRs do not count: they were rejected and a re-run is legitimate.

Also skips when data/weekly/<date>.json is already on main (--on-main, set by
the workflow from the contents API).

Input: JSON from
  gh pr list --state all --limit 200 \
    --json number,url,state,headRefName,files,isCrossRepository,author
Exit 0 + PR URL when data exists (skip); exit 1 + "none" when nothing
exists (run); exit 2 on any error (bad usage, malformed / empty / non-list
JSON, crash). The workflow fails closed on anything but 0 or 1+"none".
"""
from __future__ import annotations

import json
import re
import sys

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# Only PRs opened by the weekly job count. open_data_pr.sh runs `gh pr create`
# with WFO_WEEKLY_PAT, owned by silentdany (author of every data PR so far: #3,
# #7, #24-#36). github-actions[bot] (shown by gh as app/github-actions) covers a
# run that falls back to GITHUB_TOKEN. Override with DATA_PR_AUTHORS (comma list).
DEFAULT_AUTHORS = frozenset({"silentdany", "github-actions[bot]", "app/github-actions"})


def allowed_authors() -> frozenset[str]:
    import os
    raw = os.environ.get("DATA_PR_AUTHORS", "").strip()
    if not raw:
        return DEFAULT_AUTHORS
    return frozenset(a.strip().lower() for a in raw.split(",") if a.strip())


def _trusted(pr: dict, authors: frozenset[str]) -> bool:
    # A fork PR (or one missing the field) must never block the run (DoS).
    if pr.get("isCrossRepository") is not False:
        return False
    login = ((pr.get("author") or {}).get("login") or "").lower()
    return login in {a.lower() for a in authors}


def find_existing(prs: list[dict], date: str, authors: frozenset[str] | None = None) -> dict | None:
    """First open/merged PR that carries this date's data.

    Matches a head branch starting with data/weekly-<date> or
    data/weekly-run-<date>, or any data/weekly-* head that touches
    data/weekly/<date>.json (bot branches are data/weekly-run-<run id>).
    """
    if not _DATE_RE.match(date or ""):
        raise ValueError("date must be YYYY-MM-DD")
    target = f"data/weekly/{date}.json"
    by_name = (f"data/weekly-{date}", f"data/weekly-run-{date}")
    authors = DEFAULT_AUTHORS if authors is None else authors
    for pr in prs:
        if not _trusted(pr, authors):
            continue
        head = pr.get("headRefName") or ""
        if not head.startswith("data/weekly-"):
            continue
        state = (pr.get("state") or "").upper()
        if state not in {"OPEN", "MERGED"}:
            continue
        # Separator required: data/weekly-2026-10-1 must not match 2026-10-12.
        if any(head == p or head.startswith(p + "-") for p in by_name):
            return pr
        paths = {f.get("path") for f in (pr.get("files") or []) if isinstance(f, dict)}
        if target in paths:
            return pr
    return None


EXIT_EXISTS, EXIT_NONE, EXIT_ERROR = 0, 1, 2


def _main(argv: list[str]) -> int:
    on_main = "--on-main" in argv
    argv = [a for a in argv if a != "--on-main"]
    limit = None
    if "--limit" in argv:
        i = argv.index("--limit")
        try:
            limit = int(argv[i + 1])
        except (IndexError, ValueError):
            print("--limit needs a positive integer", file=sys.stderr)
            return EXIT_ERROR
        if limit <= 0:
            print("--limit needs a positive integer", file=sys.stderr)
            return EXIT_ERROR
        argv = argv[:i] + argv[i + 2:]
    if len(argv) != 2:
        print("usage: existing_data_pr.py YYYY-MM-DD [--on-main] [--limit N] < prs.json", file=sys.stderr)
        return EXIT_ERROR
    if not _DATE_RE.match(argv[1]):
        print("date must be YYYY-MM-DD", file=sys.stderr)
        return EXIT_ERROR
    if on_main:
        # data/weekly/<date>.json already exists on main (checked by the caller).
        print(f"main:data/weekly/{argv[1]}.json")
        return EXIT_EXISTS
    raw = sys.stdin.read()
    try:
        prs = json.loads(raw)
    except ValueError as e:
        print(f"PR list is not valid JSON ({e}): {raw[:200]!r}", file=sys.stderr)
        return EXIT_ERROR
    if not isinstance(prs, list) or not all(isinstance(p, dict) for p in prs):
        print(f"PR list must be a JSON list of objects, got {type(prs).__name__}", file=sys.stderr)
        return EXIT_ERROR
    if limit is not None and len(prs) >= limit:
        # gh pr list returned as many PRs as asked: the list may be truncated.
        print(f"PR list has {len(prs)} entries = --limit {limit}: possibly truncated, refusing to decide",
              file=sys.stderr)
        return EXIT_ERROR
    hit = find_existing(prs, argv[1], allowed_authors())
    if hit:
        print(hit.get("url") or f"#{hit.get('number')}")
        return EXIT_EXISTS
    print("none")  # explicit marker: exit 1 alone could also be a crash
    return EXIT_NONE


def main(argv: list[str]) -> int:
    """Fail closed: any unexpected exception exits 2, never 1 ("run")."""
    try:
        return _main(argv)
    except Exception as e:  # noqa: BLE001
        print(f"existing_data_pr crashed: {type(e).__name__}: {e}", file=sys.stderr)
        return EXIT_ERROR


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
