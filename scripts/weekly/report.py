"""Render weekly JSON + Markdown report. Never invents numbers."""
from __future__ import annotations

from datetime import date
from typing import Any

from .diff import DiffResult
from .sources.base import SourceResult
from .suspects import SuspectHit


def merge_companies(source_results: list[SourceResult]) -> list[dict]:
    """Merge companies across ok sources. Unavailable sources contribute nothing."""
    by_key: dict[str, dict] = {}
    for src in source_results:
        if not src.ok:
            continue
        for item in src.items:
            key = (item.get("slug") or item.get("login") or item.get("name") or "").strip().lower()
            if not key:
                continue
            cur = by_key.get(key)
            if cur is None:
                sources = list(item.get("sources") or [])
                if item.get("source") and item["source"] not in sources:
                    sources.append(item["source"])
                by_key[key] = {
                    **item,
                    "slug": key,
                    "sources": sources,
                }
            else:
                # Merge sources / beneficiaries / take known amounts carefully
                for s in item.get("sources") or ([item["source"]] if item.get("source") else []):
                    if s not in cur["sources"]:
                        cur["sources"].append(s)
                if item.get("beneficiaries"):
                    existing = {(b.get("login") or "").lower() for b in cur.get("beneficiaries") or []}
                    merged = list(cur.get("beneficiaries") or [])
                    for b in item["beneficiaries"]:
                        if (b.get("login") or "").lower() not in existing:
                            merged.append(b)
                    cur["beneficiaries"] = merged
                if item.get("ghBeneficiaries") is not None:
                    cur["ghBeneficiaries"] = item["ghBeneficiaries"]
                # Prefer explicit publicUsd when baseline had none; sum OC carefully only within OC merge
                if item.get("publicUsd") is not None:
                    if cur.get("publicUsd") is None:
                        cur["publicUsd"] = item["publicUsd"]
                    elif item.get("source") == "oc" and "oc" in (cur.get("sources") or []):
                        # already aggregated inside OC fetcher; don't double-add across sources
                        pass
                    elif item.get("source") == "osp":
                        # OSP amount is authoritative annual figure when present
                        cur["publicUsd"] = item["publicUsd"]
                if not cur.get("site") and item.get("site"):
                    cur["site"] = item["site"]
                if not cur.get("name") and item.get("name"):
                    cur["name"] = item["name"]
    return list(by_key.values())


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
) -> dict[str, Any]:
    return {
        "date": run_date.isoformat(),
        "generatedAt": None,  # filled by runner
        "durationSeconds": round(duration_s, 2),
        "denylist": {"version": denylist_version, "count": denylist_count},
        "exclusions": {"count": exclusions_count},
        "sources": [s.to_dict() for s in source_results],
        "companies": [
            {
                "slug": c.get("slug"),
                "name": c.get("name"),
                "login": c.get("login"),
                "site": c.get("site"),
                "sources": c.get("sources") or [],
                "publicUsd": c.get("publicUsd"),
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
            "GitHub Sponsors monthly amounts are almost never public; publicUsd from GH is left null.",
            "Open Collective publicUsd is cumulative totalAmountDonated (historical), not a run-rate.",
            "Open Source Pledge publicUsd is the largest parseable annual figure on the member page; null if unparseable.",
            "Suspects are FLAG-only and are never excluded by keyword alone.",
            "Spam denylist (TypeScript) and raw-exclusions.csv are applied for annotation; companies stay in ranking data.",
        ],
    }


def render_markdown(payload: dict[str, Any]) -> str:
    d = payload["date"]
    lines: list[str] = []
    lines.append(f"# WhoFundsOSS weekly scrape · {d}")
    lines.append("")
    lines.append(f"Duration: **{payload.get('durationSeconds')}s**")
    lines.append("")
    lines.append("## Sources")
    lines.append("")
    lines.append("| Source | Status | Count | Notes |")
    lines.append("|---|---|---|---|")
    for s in payload["sources"]:
        if s["status"] == "ok":
            count = s.get("count")
            note = ", ".join(f"{k}={v}" for k, v in (s.get("meta") or {}).items())
            lines.append(f"| {s['name']} | ok | {count} | {note} |")
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
    )
    lines.append("")
    lines.append(
        f"- New sponsors: **{counts['new_sponsors']}**"
        f" · Disappeared: **{counts['disappeared_sponsors']}**"
        f" · New sponsorships: **{counts['new_sponsorships']}**"
        f" · Amount changes: **{counts['amount_changes']}**"
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

    _section("New sponsors", diff["new_sponsors"], lambda r: f"`{r['slug']}` · {r.get('name') or ''} · sources={','.join(r.get('sources') or [])}")
    _section("Disappeared sponsors", diff["disappeared_sponsors"], lambda r: f"`{r['slug']}` · {r.get('name') or ''}")
    _section("New sponsorships", diff["new_sponsorships"], lambda r: f"`{r['sponsor']}` → `{r['beneficiary']}`")
    _section(
        "Amount changes",
        diff["amount_changes"],
        lambda r: f"`{r['slug']}` · {r['from']} → {r['to']} (Δ {r['delta']})",
    )
    _section(
        "Beneficiary count changes (GitHub)",
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
        f"- Spam denylist version `{payload['denylist']['version']}` · {payload['denylist']['count']} slugs (source: `src/lib/spam-denylist.ts`)"
    )
    lines.append(
        f"- Raw exclusions CSV · {payload['exclusions']['count']} rows (source: `data/exclusions/raw-exclusions.csv`)"
    )
    noted = payload.get("excludedNoted") or []
    if noted:
        lines.append(f"- Live companies also on denylist/exclusions this run: **{len(noted)}** (annotated, not removed from ranking dump)")
    lines.append("")
    lines.append("## Notes")
    lines.append("")
    for n in payload.get("notes") or []:
        lines.append(f"- {n}")
    lines.append("")
    return "\n".join(lines)
