#!/usr/bin/env python3
"""WhoFundsOSS weekly scraper entrypoint.

Default = full catalog scope (all GH catalog sponsors, all OC collectives,
all OSP members). Caps are opt-in for local smoke only.

Usage:
  python3 -m scripts.weekly.run
  python3 -m scripts.weekly.run --max-oc 20 --gh-logins vercel,getsentry   # smoke
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import date, datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.weekly.denylist import is_excluded, load_raw_exclusions, parse_spam_denylist
from scripts.weekly.diff import (
    diff_snapshots,
    explain_new_against_catalog,
    load_baseline,
)
from scripts.weekly.normalize import build_catalog_index
from scripts.weekly.report import (
    build_payload,
    coverage_from_results,
    merge_companies,
    render_markdown,
)
from scripts.weekly.sources.github_sponsors import fetch_github_sponsors
from scripts.weekly.sources.open_collective import fetch_open_collective
from scripts.weekly.sources.open_source_pledge import fetch_open_source_pledge
from scripts.weekly.suspects import flag_suspects


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="WhoFundsOSS weekly sponsorship scraper")
    p.add_argument("--date", default=None, help="Run date YYYY-MM-DD (default: today)")
    p.add_argument("--out-dir", default=str(REPO_ROOT / "data" / "weekly"))
    p.add_argument("--catalog", default=str(REPO_ROOT / "src" / "data" / "catalog.json"))
    p.add_argument("--skip-gh", action="store_true")
    p.add_argument("--skip-oc", action="store_true")
    p.add_argument("--skip-osp", action="store_true")
    p.add_argument("--max-oc", type=int, default=None, help="Cap OC collectives (smoke only)")
    p.add_argument("--max-osp", type=int, default=None, help="Cap OSP members (smoke only)")
    p.add_argument("--gh-logins", default=None, help="Comma-separated GH logins (smoke only; marks GH coverage partial)")
    p.add_argument("--max-gh", type=int, default=None, help="Cap GH logins after catalog seed (smoke)")
    p.add_argument("--suspicious-pct", type=float, default=10.0)
    p.add_argument("--strict", action="store_true", help="Exit 1 if any source is unavailable")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    t0 = time.time()

    date_str = args.date or date.today().isoformat()
    if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", date_str):
        print("bad --date, expected YYYY-MM-DD", file=sys.stderr)
        return 2
    try:
        run_date = date.fromisoformat(date_str)
    except ValueError:
        print("bad --date, expected YYYY-MM-DD", file=sys.stderr)
        return 2

    catalog_path = Path(args.catalog)
    try:
        denylist_version, denylist = parse_spam_denylist()
        exclusions = load_raw_exclusions()
        catalog_index = build_catalog_index(catalog_path) if catalog_path.exists() else None
    except Exception as e:
        print(f"fatal: denylist/exclusions/catalog: {e}", file=sys.stderr)
        return 1

    results = []
    gh_override = bool(args.gh_logins) or args.max_gh is not None

    if not args.skip_gh:
        logins = [x.strip() for x in args.gh_logins.split(",") if x.strip()] if args.gh_logins else None
        if logins is None and args.max_gh is not None and catalog_index is not None:
            from scripts.weekly.sources.github_sponsors import seed_logins_from_catalog

            logins = seed_logins_from_catalog(catalog_path)[: args.max_gh]
            gh_override = True
        print("fetching github_sponsors…", flush=True)
        gh = fetch_github_sponsors(logins=logins, catalog_path=catalog_path)
        if gh.ok and gh_override:
            gh.meta["capped"] = True
        results.append(gh)
        print(f"  → {gh.status} count={len(gh.items) if gh.ok else '—'}", flush=True)

    if not args.skip_oc:
        print("fetching open_collective…", flush=True)
        oc = fetch_open_collective(max_collectives=args.max_oc)
        results.append(oc)
        print(f"  → {oc.status} count={len(oc.items) if oc.ok else '—'}", flush=True)

    if not args.skip_osp:
        print("fetching open_source_pledge…", flush=True)
        osp = fetch_open_source_pledge(max_members=args.max_osp)
        results.append(osp)
        print(f"  → {osp.status} count={len(osp.items) if osp.ok else '—'}", flush=True)

    if not results:
        print("fatal: all sources skipped", file=sys.stderr)
        return 1

    ok_sources = [r for r in results if r.ok]
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    if not ok_sources:
        stub = {
            "date": run_date.isoformat(),
            "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "durationSeconds": round(time.time() - t0, 2),
            "suspicious": True,
            "sources": [r.to_dict() for r in results],
            "companies": [],
            "coverage": {},
            "diff": {
                "baseline_kind": "none",
                "baseline_path": None,
                "baseline_size": 0,
                "suspicious": True,
                "suspicious_reasons": ["ALL sources unavailable"],
                "counts": {
                    "new_sponsors": 0,
                    "disappeared_sponsors": 0,
                    "unverified_partial": 0,
                    "new_sponsorships": 0,
                    "amount_changes": 0,
                    "beneficiary_changes": 0,
                },
                "new_sponsors": [],
                "disappeared_sponsors": [],
                "unverified_partial": [],
                "new_sponsorships": [],
                "amount_changes": [],
                "beneficiary_changes": [],
            },
            "suspects": [],
            "notes": ["ALL sources unavailable — no numbers invented."],
        }
        (out_dir / f"{run_date.isoformat()}.json").write_text(json.dumps(stub, indent=2) + "\n", encoding="utf-8")
        (out_dir / f"{run_date.isoformat()}.md").write_text(
            f"# WhoFundsOSS weekly scrape · {run_date.isoformat()}\n\n"
            "## ⚠ DIFF SUSPICIOUS — CHECK COVERAGE\n\nALL sources unavailable. No numbers invented.\n",
            encoding="utf-8",
        )
        print("ALL sources unavailable", file=sys.stderr)
        return 1

    companies = merge_companies(results, catalog_index=catalog_index, apply_retention=True)

    # Drop denylist / raw-exclusion hits from the ranking snapshot of "new" noise,
    # but keep them annotated.
    excluded_noted = []
    kept = []
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
            # Still keep in companies (ranking untouched) but they won't inflate "new"
            # as actionable — explain_new filters via note; we also tag them.
        kept.append(c)
    companies = kept

    coverage = coverage_from_results(
        results,
        max_oc=args.max_oc,
        max_osp=args.max_osp,
        gh_logins_override=gh_override,
    )

    baseline_kind, baseline_path, baseline_companies = load_baseline(
        out_dir, catalog_path, run_date=run_date.isoformat()
    )

    diff = diff_snapshots(
        companies,
        baseline_companies,
        baseline_kind=baseline_kind,
        baseline_path=baseline_path,
        coverage=coverage,
        suspicious_pct=args.suspicious_pct,
    )

    excluded_slugs = {e["slug"] for e in excluded_noted if e.get("slug")}

    def _row_excluded(row: dict) -> bool:
        slug = row.get("slug") or row.get("sponsor") or ""
        if slug in excluded_slugs:
            return True
        return bool(
            is_excluded(
                slug=slug,
                name=row.get("name") or "",
                site="",
                login=row.get("login") or slug,
                denylist=denylist,
                exclusions=exclusions,
            )
        )

    # Annotate new sponsors vs catalog; drop false "new" that alias back into catalog
    if baseline_kind == "catalog" and catalog_path.exists():
        annotated = explain_new_against_catalog(diff.new_sponsors, catalog_path)
        real_new = []
        for row in annotated:
            if row.get("in_catalog"):
                continue
            if _row_excluded(row):
                continue
            # Empty GH-only seeds are not "new sponsors"
            sources = set(row.get("sources") or [])
            if sources <= {"gh"}:
                # Look up live company for beneficiary count
                live = next((c for c in companies if c.get("slug") == row.get("slug")), None)
                if live is not None:
                    bens = live.get("ghBeneficiaries") or 0
                    if int(bens or 0) <= 0 and not live.get("beneficiaries"):
                        continue
            real_new.append(row)
        diff.new_sponsors = real_new

    # Denylist + exclusions apply to ALL diff sections
    diff.new_sponsors = [r for r in diff.new_sponsors if not _row_excluded(r)]
    diff.disappeared_sponsors = [r for r in diff.disappeared_sponsors if not _row_excluded(r)]
    diff.unverified_partial = [r for r in diff.unverified_partial if not _row_excluded(r)]
    diff.amount_changes = [r for r in diff.amount_changes if not _row_excluded(r)]
    diff.beneficiary_changes = [r for r in diff.beneficiary_changes if not _row_excluded(r)]
    diff.new_sponsorships = [r for r in diff.new_sponsorships if not _row_excluded(r)]

    # Recompute suspicious after filtering
    diff.suspicious = False
    diff.suspicious_reasons = []
    if diff.baseline_size > 0:
        new_pct = 100.0 * len(diff.new_sponsors) / diff.baseline_size
        dis_pct = 100.0 * len(diff.disappeared_sponsors) / diff.baseline_size
        if new_pct > args.suspicious_pct:
            diff.suspicious = True
            diff.suspicious_reasons.append(
                f"new_sponsors {len(diff.new_sponsors)} = {new_pct:.1f}% of baseline {diff.baseline_size}"
            )
        if dis_pct > args.suspicious_pct:
            diff.suspicious = True
            diff.suspicious_reasons.append(
                f"disappeared_sponsors {len(diff.disappeared_sponsors)} = {dis_pct:.1f}% of baseline {diff.baseline_size}"
            )

    suspects = flag_suspects(companies, denylist_slugs=set(denylist.keys()))
    suspects = [h for h in suspects if h.slug not in excluded_slugs]

    run_id = os.environ.get("GITHUB_RUN_ID") or "local"

    # Collect non-USD rows from OC meta
    non_usd = []
    for r in results:
        if r.name == "open_collective":
            non_usd = list((r.meta or {}).get("non_usd") or [])

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
        coverage=coverage,
        run_id=run_id,
        non_usd=non_usd,
    )
    payload["generatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    json_path = out_dir / f"{run_date.isoformat()}.json"
    md_path = out_dir / f"{run_date.isoformat()}.md"
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    md_path.write_text(render_markdown(payload), encoding="utf-8")

    print(f"wrote {json_path}")
    print(f"wrote {md_path}")
    counts = diff.to_dict()["counts"]
    print(
        f"companies={len(companies)} new={counts['new_sponsors']} "
        f"disappeared={counts['disappeared_sponsors']} unverified={counts['unverified_partial']} "
        f"amount={counts['amount_changes']} suspicious={diff.suspicious} "
        f"sources_ok={len(ok_sources)}/{len(results)}"
    )

    if args.strict and any(not r.ok for r in results):
        print("strict: at least one source unavailable", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
