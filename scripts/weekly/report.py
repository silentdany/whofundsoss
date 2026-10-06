"""Render weekly JSON + Markdown report. Never invents numbers."""
from __future__ import annotations

from datetime import date
from typing import Any

from .diff import CoverageReport, DiffResult
from .normalize import CatalogIndex, build_catalog_index, passes_retention
from .sources.base import SourceResult
from .suspects import SuspectHit


def merge_companies(
    source_results: list[SourceResult],
    *,
    catalog_index: CatalogIndex | None = None,
    apply_retention: bool = True,
) -> list[dict]:
    """Merge companies across ok sources with catalog-aligned slugs."""
    by_key: dict[str, dict] = {}
    for src in source_results:
        if not src.ok:
            continue
        short = {
            "github_sponsors": "gh",
            "open_collective": "oc",
            "open_source_pledge": "osp",
        }.get(src.name, src.name)

        for item in src.items:
            login = item.get("login")
            name = item.get("name")
            site = item.get("site")
            if catalog_index is not None:
                key = catalog_index.resolve(
                    login=login,
                    name=name,
                    site=site,
                    osp_slug=item.get("ospSlug"),
                    oc_slug=item.get("ocSlug") or (item.get("slug") if short == "oc" else None),
                )
            else:
                key = (item.get("slug") or login or name or "").strip().lower()
            if not key:
                continue

            cur = by_key.get(key)
            if cur is None:
                sources = list(item.get("sources") or [])
                if short not in sources:
                    sources.append(short)
                by_source = {"oc": None, "osp": None, "gh": None, "own": None}
                if item.get("publicUsd") is not None and short in by_source:
                    by_source[short] = float(item["publicUsd"])
                by_key[key] = {
                    "slug": key,
                    "name": name or key,
                    "login": login,
                    "site": site,
                    "sources": sources,
                    "publicUsdBySource": by_source,
                    "publicUsd": item.get("publicUsd"),
                    "ghBeneficiaries": item.get("ghBeneficiaries"),
                    "beneficiaries": list(item.get("beneficiaries") or []),
                    "collectives": list(item.get("collectives") or []),
                    "ospSlug": item.get("ospSlug"),
                    "reportUrl": item.get("reportUrl"),
                }
            else:
                if short not in cur["sources"]:
                    cur["sources"].append(short)
                if item.get("beneficiaries"):
                    existing = {(b.get("login") or "").lower() for b in cur.get("beneficiaries") or []}
                    merged = list(cur.get("beneficiaries") or [])
                    for b in item["beneficiaries"]:
                        if (b.get("login") or "").lower() not in existing:
                            merged.append(b)
                    cur["beneficiaries"] = merged
                if item.get("ghBeneficiaries") is not None:
                    cur["ghBeneficiaries"] = item["ghBeneficiaries"]
                if item.get("collectives"):
                    for col in item["collectives"]:
                        if col not in cur["collectives"]:
                            cur["collectives"].append(col)
                if item.get("publicUsd") is not None:
                    if short == "oc":
                        prev = cur["publicUsdBySource"].get("oc") or 0.0
                        # OC fetcher already aggregates per company across collectives;
                        # when merging a second pass, take max to avoid double-count
                        cur["publicUsdBySource"]["oc"] = max(float(prev), float(item["publicUsd"]))
                    elif short == "osp":
                        cur["publicUsdBySource"]["osp"] = float(item["publicUsd"])
                    elif short == "gh":
                        cur["publicUsdBySource"]["gh"] = float(item["publicUsd"])
                if not cur.get("site") and site:
                    cur["site"] = site
                if (not cur.get("name") or cur["name"] == key) and name:
                    cur["name"] = name
                if not cur.get("login") and login:
                    cur["login"] = login

    # Recompute publicUsd as sum of known bySource (None-safe)
    out = []
    for c in by_key.values():
        parts = [v for v in (c.get("publicUsdBySource") or {}).values() if v is not None]
        c["publicUsd"] = round(sum(float(v) for v in parts), 2) if parts else None
        if apply_retention and not passes_retention(c):
            continue
        out.append(c)
    return out


def coverage_from_results(
    source_results: list[SourceResult],
    *,
    max_oc: int | None,
    max_osp: int | None,
    gh_logins_override: bool,
    min_oc_success_ratio: float = 0.85,
) -> CoverageReport:
    """Mark a source as full only when it succeeded uncapped with healthy yield.

    Open Collective: many seed collective slugs 404. We still require
    ok_collectives / attempted >= min_oc_success_ratio before calling coverage
    "full" — otherwise OC-only disappearances must go to unverified_partial.
    """
    cov = CoverageReport()
    for r in source_results:
        meta = dict(r.meta or {})
        capped = bool(
            (r.name == "open_collective" and max_oc is not None)
            or (r.name == "open_source_pledge" and max_osp is not None)
            or (r.name == "github_sponsors" and gh_logins_override)
            or meta.get("capped")
        )
        if r.name == "github_sponsors":
            soft = int(meta.get("soft_errors") or 0)
            attempted = int(meta.get("attempted") or 0) or 1
            full = r.ok and not capped and (soft / attempted) <= 0.15
        elif r.name == "open_collective":
            attempted = int(meta.get("attempted") or 0) or 1
            ok_c = int(meta.get("ok_collectives") or 0)
            ratio = ok_c / attempted
            meta["success_ratio"] = round(ratio, 3)
            full = r.ok and not capped and ratio >= min_oc_success_ratio
        elif r.name == "open_source_pledge":
            full = r.ok and not capped
        else:
            full = r.ok and not capped
        cov.sources[r.name] = {
            "full": full,
            "status": r.status,
            "count": len(r.items) if r.ok else None,
            "capped": capped,
            "meta": meta,
            "error": r.error,
        }
    return cov


def build_payload(
    *,
    run_date: date,
    source_results: list[SourceResult],
    companies: list[dict],
    diff: DiffResult,
    suspects: list[SuspectHit],
    denylist_version: str,
    denylist_count: int,
    exclusions_count: int,
    excluded_from_report: list[dict],
    duration_s: float,
    coverage: CoverageReport,
) -> dict[str, Any]:
    return {
        "date": run_date.isoformat(),
        "generatedAt": None,
        "durationSeconds": round(duration_s, 2),
        "suspicious": diff.suspicious,
        "denylist": {"version": denylist_version, "count": denylist_count},
        "exclusions": {"count": exclusions_count},
        "coverage": coverage.to_dict(),
        "sources": [s.to_dict() for s in source_results],
        "companies": [
            {
                "slug": c.get("slug"),
                "name": c.get("name"),
                "login": c.get("login"),
                "site": c.get("site"),
                "sources": c.get("sources") or [],
                "publicUsd": c.get("publicUsd"),
                "publicUsdBySource": c.get("publicUsdBySource"),
                "ghBeneficiaries": c.get("ghBeneficiaries"),
                "beneficiaries": c.get("beneficiaries"),
                "collectives": c.get("collectives"),
                "ospSlug": c.get("ospSlug"),
                "reportUrl": c.get("reportUrl"),
            }
            for c in companies
        ],
        "diff": diff.to_dict(),
        "suspects": [
            {
                "slug": h.slug,
                "name": h.name,
                "matched_keywords": list(h.matched_keywords),
                "already_denylisted": h.already_denylisted,
            }
            for h in suspects
        ],
        "excludedNoted": excluded_from_report,
        "notes": [
            "GitHub Sponsors monthly amounts are almost never public; gh publicUsd is left null.",
            "Open Collective publicUsd is cumulative totalAmountDonated (historical), not a run-rate.",
            "Open Source Pledge publicUsd is the largest parseable annual figure on the member page; null if unparseable.",
            "Amount diffs are like-with-like (oc↔oc, osp↔osp, own↔own).",
            "Disappearances require full coverage on every source that covers the baseline company; otherwise → unverified_partial.",
            "Suspects are FLAG-only and are never excluded by keyword alone.",
            "Retention filter matches the catalog build: gh/osp/own, or OC with ≥3 collectives or ≥$5k public.",
        ],
    }


def render_markdown(payload: dict[str, Any]) -> str:
    d = payload["date"]
    lines: list[str] = []
    lines.append(f"# WhoFundsOSS weekly scrape · {d}")
    lines.append("")
    if payload.get("suspicious") or (payload.get("diff") or {}).get("suspicious"):
        lines.append("## ⚠ DIFF SUSPICIOUS — CHECK COVERAGE")
        lines.append("")
        lines.append(
            "New or disappeared sponsors exceed the sanity threshold versus the baseline. "
            "Do **not** treat this as a real mass disappearance. Inspect `coverage` and "
            "`unverified_partial` before the WFOSS Data bot acts."
        )
        lines.append("")
        for reason in (payload.get("diff") or {}).get("suspicious_reasons") or []:
            lines.append(f"- {reason}")
        lines.append("")

    lines.append(f"Duration: **{payload.get('durationSeconds')}s**")
    lines.append("")

    lines.append("## Coverage")
    lines.append("")
    lines.append("| Source | Full? | Status | Count | Capped? |")
    lines.append("|---|---|---|---|---|")
    for name, meta in (payload.get("coverage") or {}).items():
        lines.append(
            f"| {name} | {'yes' if meta.get('full') else 'no'} | {meta.get('status')} | "
            f"{meta.get('count') if meta.get('count') is not None else '—'} | "
            f"{'yes' if meta.get('capped') else 'no'} |"
        )
    lines.append("")

    lines.append("## Sources")
    lines.append("")
    lines.append("| Source | Status | Count | Notes |")
    lines.append("|---|---|---|---|")
    for s in payload["sources"]:
        if s["status"] == "ok":
            note = ", ".join(f"{k}={v}" for k, v in (s.get("meta") or {}).items())
            lines.append(f"| {s['name']} | ok | {s.get('count')} | {note} |")
        else:
            err = (s.get("error") or "source unavailable").replace("|", "/")
            lines.append(f"| {s['name']} | **source unavailable** | — | {err} |")
    lines.append("")

    diff = payload["diff"]
    counts = diff["counts"]
    lines.append("## Diff")
    lines.append("")
    lines.append(
        f"Baseline: `{diff['baseline_kind']}`"
        + (f" ({diff['baseline_path']})" if diff.get("baseline_path") else "")
        + f" · size **{diff.get('baseline_size', '—')}**"
    )
    lines.append("")
    lines.append(
        f"- New sponsors: **{counts['new_sponsors']}**"
        f" · Disappeared (verified): **{counts['disappeared_sponsors']}**"
        f" · Unverified (partial coverage): **{counts.get('unverified_partial', 0)}**"
        f" · New sponsorships: **{counts['new_sponsorships']}**"
        f" · Amount changes (like-with-like): **{counts['amount_changes']}**"
        f" · Beneficiary count changes: **{counts['beneficiary_changes']}**"
    )
    lines.append("")

    def _section(title: str, rows: list[dict], fmt) -> None:
        lines.append(f"### {title}")
        lines.append("")
        if not rows:
            lines.append("_None._")
            lines.append("")
            return
        for row in rows[:50]:
            lines.append(f"- {fmt(row)}")
        if len(rows) > 50:
            lines.append(f"- … and {len(rows) - 50} more")
        lines.append("")

    _section(
        "New sponsors",
        diff["new_sponsors"],
        lambda r: (
            f"`{r['slug']}` · {r.get('name') or ''} · sources={','.join(r.get('sources') or [])}"
            + (f" · {r['note']}" if r.get("note") else "")
        ),
    )
    _section(
        "Disappeared sponsors (verified full coverage)",
        diff["disappeared_sponsors"],
        lambda r: f"`{r['slug']}` · {r.get('name') or ''} · sources={','.join(r.get('sources') or [])}",
    )
    _section(
        "Unverified (partial coverage)",
        diff.get("unverified_partial") or [],
        lambda r: (
            f"`{r['slug']}` · {r.get('name') or ''} · missing coverage on "
            f"{', '.join(r.get('unverified_because') or [])}"
        ),
    )
    _section("New sponsorships", diff["new_sponsorships"], lambda r: f"`{r['sponsor']}` → `{r['beneficiary']}`")
    _section(
        "Amount changes (like-with-like)",
        diff["amount_changes"],
        lambda r: f"`{r['slug']}` · {r.get('source')} · {r['from']} → {r['to']} (Δ {r['delta']})",
    )
    _section(
        "Beneficiary count changes (GitHub, full coverage only)",
        diff["beneficiary_changes"],
        lambda r: f"`{r['slug']}` · {r['from']} → {r['to']}",
    )

    lines.append("## Suspects (flag only · not excluded)")
    lines.append("")
    suspects = payload.get("suspects") or []
    fresh = [s for s in suspects if not s.get("already_denylisted")]
    known = [s for s in suspects if s.get("already_denylisted")]
    if not fresh:
        lines.append("_No new keyword suspects outside the denylist._")
        lines.append("")
    else:
        for s in fresh[:40]:
            lines.append(
                f"- `{s['slug']}` · {s.get('name') or ''} · keywords={', '.join(s.get('matched_keywords') or [])}"
            )
        lines.append("")
    if known:
        lines.append(f"_Also matched but already denylisted: {len(known)} (skipped as new risk)._")
        lines.append("")

    lines.append("## Denylist / exclusions")
    lines.append("")
    lines.append(
        f"- Spam denylist version `{payload['denylist']['version']}` · {payload['denylist']['count']} slugs"
    )
    lines.append(f"- Raw exclusions CSV · {payload['exclusions']['count']} rows")
    noted = payload.get("excludedNoted") or []
    if noted:
        lines.append(f"- Live companies also on denylist/exclusions this run: **{len(noted)}**")
    lines.append("")
    lines.append("## Notes")
    lines.append("")
    for n in payload.get("notes") or []:
        lines.append(f"- {n}")
    lines.append("")
    return "\n".join(lines)
