#!/usr/bin/env python3
"""WhoFundsOSS weekly scraper entrypoint.

Usage:
  python3 -m scripts.weekly.run
  python3 -m scripts.weekly.run --date 2026-10-06 --max-oc 20 --max-osp 5 --gh-logins vercel,getsentry

Exit codes:
  0 = at least one source ok, report written
  1 = all sources unavailable, or fatal parse error
  2 = bad CLI args
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date, datetime, timezone
from pathlib import Path

# Allow `python3 -m scripts.weekly.run` from repo root
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.weekly.denylist import is_excluded, load_raw_exclusions, parse_spam_denylist
from scripts.weekly.diff import diff_snapshots, load_baseline
from scripts.weekly.report import build_payload, merge_companies, render_markdown
from scripts.weekly.sources.github_sponsors import fetch_github_sponsors
from scripts.weekly.sources.open_collective import fetch_open_collective
from scripts.weekly.sources.open_source_pledge import fetch_open_source_pledge
from scripts.weekly.suspects import flag_suspects


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="WhoFundsOSS weekly sponsorship scraper")
    p.add_argument("--date", default=None, help="Run date YYYY-MM-DD (default: today Paris/UTC date)")
    p.add_argument("--out-dir", default=str(REPO_ROOT / "data" / "weekly"))
    p.add_argument("--catalog", default=str(REPO_ROOT / "src" / "data" / "catalog.json"))
    p.add_argument("--skip-gh", action="store_true")
    p.add_argument("--skip-oc", action="store_true")
    p.add_argument("--skip-osp", action="store_true")
    p.add_argument("--max-oc", type=int, default=None, help="Cap OC collectives (dev/smoke)")
    p.add_argument("--max-osp", type=int, default=None, help="Cap OSP members (dev/smoke)")
    p.add_argument("--gh-logins", default=None, help="Comma-separated GH logins to check")
    p.add_argument("--strict", action="store_true", help="Exit 1 if any source is unavailable")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    t0 = time.time()

    try:
        run_date = date.fromisoformat(args.date) if args.date else date.today()
    except ValueError:
        print("bad --date, expected YYYY-MM-DD", file=sys.stderr)
        return 2

    try:
        denylist_version, denylist = parse_spam_denylist()
        exclusions = load_raw_exclusions()
    except Exception as e:
        print(f"fatal: denylist/exclusions: {e}", file=sys.stderr)
        return 1

    results = []
    if not args.skip_gh:
        logins = [x.strip() for x in args.gh_logins.split(",") if x.strip()] if args.gh_logins else None
        print("fetching github_sponsors…", flush=True)
        results.append(fetch_github_sponsors(logins=logins, catalog_path=Path(args.catalog)))
        print(f"  → {results[-1].status} count={len(results[-1].items) if results[-1].ok else '—'}", flush=True)
    if not args.skip_oc:
        print("fetching open_collective…", flush=True)
        results.append(fetch_open_collective(max_collectives=args.max_oc))
        print(f"  → {results[-1].status} count={len(results[-1].items) if results[-1].ok else '—'}", flush=True)
    if not args.skip_osp:
        print("fetching open_source_pledge…", flush=True)
        results.append(fetch_open_source_pledge(max_members=args.max_osp))
        print(f"  → {results[-1].status} count={len(results[-1].items) if results[-1].ok else '—'}", flush=True)

    if not results:
        print("fatal: all sources skipped", file=sys.stderr)
        return 1

    ok_sources = [r for r in results if r.ok]
    if not ok_sources:
        # Still write a stub report marking every source unavailable
        out_dir = Path(args.out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        stub = {
            "date": run_date.isoformat(),
            "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "durationSeconds": round(time.time() - t0, 2),
            "sources": [r.to_dict() for r in results],
            "companies": [],
            "diff": {"baseline_kind": "none", "baseline_path": None, "counts": {}, "new_sponsors": [], "disappeared_sponsors": [], "new_sponsorships": [], "amount_changes": [], "beneficiary_changes": []},
            "suspects": [],
            "notes": ["ALL sources unavailable — no numbers invented."],
        }
        (out_dir / f"{run_date.isoformat()}.json").write_text(json.dumps(stub, indent=2) + "\n", encoding="utf-8")
        (out_dir / f"{run_date.isoformat()}.md").write_text(
            f"# WhoFundsOSS weekly scrape · {run_date.isoformat()}\n\nALL sources unavailable. No numbers invented.\n",
            encoding="utf-8",
        )
        print("ALL sources unavailable", file=sys.stderr)
        return 1

    companies = merge_companies(results)

    # Annotate exclusions / denylist — do NOT drop from companies list (ranking untouched)
    excluded_noted = []
    for c in companies:
        reason = is_excluded(
            slug=c.get("slug") or "",
            name=c.get("name") or "",
            site=c.get("site") or "",
            login=c.get("login") or "",
            denylist=denylist,
            exclusions=exclusions,
        )
        if reason:
            c["exclusionNote"] = reason
            excluded_noted.append({"slug": c.get("slug"), "reason": reason})

    baseline_kind, baseline_path, baseline_companies = load_baseline(Path(args.out_dir), Path(args.catalog))
    # If baseline is today's file from a previous attempt, prefer catalog / previous
    if baseline_kind == "weekly" and baseline_path and Path(baseline_path).stem == run_date.isoformat():
        older = sorted(Path(args.out_dir).glob("????-??-??.json"))
        older = [p for p in older if p.stem < run_date.isoformat()]
        if older:
            data = json.loads(older[-1].read_text(encoding="utf-8"))
            baseline_kind, baseline_path, baseline_companies = "weekly", str(older[-1]), data.get("companies") or []
        elif Path(args.catalog).exists():
            from scripts.weekly.diff import catalog_as_companies

            catalog = json.loads(Path(args.catalog).read_text(encoding="utf-8"))
            baseline_kind, baseline_path, baseline_companies = "catalog", args.catalog, catalog_as_companies(catalog)
        else:
            baseline_kind, baseline_path, baseline_companies = "none", None, []

    diff = diff_snapshots(companies, baseline_companies, baseline_kind=baseline_kind, baseline_path=baseline_path)
    suspects = flag_suspects(companies, denylist_slugs=set(denylist.keys()))

    payload = build_payload(
        run_date=run_date,
        source_results=results,
        companies=companies,
        diff=diff,
        suspects=suspects,
        denylist_version=denylist_version,
        denylist_count=len(denylist),
        exclusions_count=len(exclusions),
        excluded_from_report=excluded_noted,
        duration_s=time.time() - t0,
    )
    payload["generatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / f"{run_date.isoformat()}.json"
    md_path = out_dir / f"{run_date.isoformat()}.md"
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    md_path.write_text(render_markdown(payload), encoding="utf-8")

    print(f"wrote {json_path}")
    print(f"wrote {md_path}")
    print(
        f"companies={len(companies)} new={diff.to_dict()['counts']['new_sponsors']} "
        f"suspects={len(suspects)} sources_ok={len(ok_sources)}/{len(results)}"
    )

    if args.strict and any(not r.ok for r in results):
        print("strict: at least one source unavailable", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
