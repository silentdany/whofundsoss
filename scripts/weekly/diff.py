"""Coverage-aware diff against the previous weekly file or the catalog.

Rules (CdP 2026-10-06):
- Disappearances only when every source that covers the baseline company ran
  with full coverage; otherwise → unverified (partial coverage).
- Amount changes are like-with-like (same source key: oc / osp / gh / own).
- If new or disappeared > threshold of baseline size → suspicious banner.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .normalize import build_catalog_index

DEFAULT_SUSPICIOUS_PCT = 10.0


@dataclass
class CoverageReport:
    """Per-source coverage for the current run."""

    sources: dict[str, dict[str, Any]] = field(default_factory=dict)

    def full(self, name: str) -> bool:
        meta = self.sources.get(name) or {}
        return bool(meta.get("full"))

    def to_dict(self) -> dict[str, Any]:
        return dict(self.sources)


@dataclass
class DiffResult:
    baseline_kind: str
    baseline_path: str | None
    new_sponsors: list[dict] = field(default_factory=list)
    disappeared_sponsors: list[dict] = field(default_factory=list)
    unverified_partial: list[dict] = field(default_factory=list)
    new_sponsorships: list[dict] = field(default_factory=list)
    amount_changes: list[dict] = field(default_factory=list)
    beneficiary_changes: list[dict] = field(default_factory=list)
    suspicious: bool = False
    suspicious_reasons: list[str] = field(default_factory=list)
    baseline_size: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "baseline_kind": self.baseline_kind,
            "baseline_path": self.baseline_path,
            "baseline_size": self.baseline_size,
            "suspicious": self.suspicious,
            "suspicious_reasons": self.suspicious_reasons,
            "counts": {
                "new_sponsors": len(self.new_sponsors),
                "disappeared_sponsors": len(self.disappeared_sponsors),
                "unverified_partial": len(self.unverified_partial),
                "new_sponsorships": len(self.new_sponsorships),
                "amount_changes": len(self.amount_changes),
                "beneficiary_changes": len(self.beneficiary_changes),
            },
            "new_sponsors": self.new_sponsors,
            "disappeared_sponsors": self.disappeared_sponsors,
            "unverified_partial": self.unverified_partial,
            "new_sponsorships": self.new_sponsorships,
            "amount_changes": self.amount_changes,
            "beneficiary_changes": self.beneficiary_changes,
        }


def _index_companies(companies: list[dict]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for c in companies:
        key = (c.get("slug") or c.get("login") or "").strip().lower()
        if not key:
            continue
        out[key] = c
    return out


def catalog_as_companies(catalog: dict) -> list[dict]:
    """Normalize published catalog into weekly shape, including bySource."""
    details = catalog.get("details") or {}
    rows = []
    for row in catalog.get("index") or []:
        slug = row.get("slug")
        by = (details.get(slug) or {}).get("bySource") or {}
        by_source = {
            "oc": float(by.get("oc") or 0) or None,
            "osp": float(by.get("osp") or 0) or None,
            "gh": float(by.get("gh") or 0) or None,
            "own": float(by.get("own") or 0) or None,
        }
        # Normalize zeros that mean "no data" for gh (almost never public) back to None
        if by_source["gh"] == 0:
            by_source["gh"] = None
        rows.append({
            "slug": slug,
            "name": row.get("name"),
            "site": row.get("site"),
            "login": slug,
            "sources": list(row.get("sources") or []),
            "publicUsd": row.get("publicUsd"),
            "publicUsdBySource": by_source,
            "ghBeneficiaries": row.get("ghBeneficiaries"),
            "projects": row.get("projects"),
        })
    return rows


def load_baseline(weekly_dir: Path, catalog_path: Path, *, run_date: str | None = None) -> tuple[str, str | None, list[dict]]:
    weekly_dir.mkdir(parents=True, exist_ok=True)
    snapshots = sorted(weekly_dir.glob("????-??-??.json"))
    if run_date:
        snapshots = [p for p in snapshots if p.stem < run_date]
    if snapshots:
        path = snapshots[-1]
        data = json.loads(path.read_text(encoding="utf-8"))
        return "weekly", str(path), data.get("companies") or []
    if catalog_path.exists():
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        return "catalog", str(catalog_path), catalog_as_companies(catalog)
    return "none", None, []


def _sources_of(company: dict) -> set[str]:
    sources = set(company.get("sources") or [])
    if company.get("source"):
        sources.add(company["source"])
    # Map weekly source names to short keys used in catalog
    mapped = set()
    for s in sources:
        if s in {"gh", "oc", "osp", "own"}:
            mapped.add(s)
        elif s == "github_sponsors":
            mapped.add("gh")
        elif s == "open_collective":
            mapped.add("oc")
        elif s == "open_source_pledge":
            mapped.add("osp")
        else:
            mapped.add(s)
    return mapped


SOURCE_FULL_KEY = {
    "gh": "github_sponsors",
    "oc": "open_collective",
    "osp": "open_source_pledge",
    "own": "own",  # never scraped weekly → never "full"
}


def _coverage_allows_disappearance(baseline_sources: set[str], coverage: CoverageReport) -> tuple[bool, list[str]]:
    """True only when every covering source ran with full coverage."""
    if not baseline_sources:
        # Unknown provenance — never call disappeared
        return False, ["unknown_sources"]
    missing = []
    for src in baseline_sources:
        key = SOURCE_FULL_KEY.get(src, src)
        if src == "own":
            # Own programmes are not re-fetched weekly → cannot verify disappearance
            missing.append("own")
            continue
        if not coverage.full(key):
            missing.append(key)
    return (len(missing) == 0), missing


def _amount_by_source(company: dict) -> dict[str, float | None]:
    by = dict(company.get("publicUsdBySource") or {})
    # Ensure keys exist
    for k in ("oc", "osp", "gh", "own"):
        by.setdefault(k, None)
    return by


def diff_snapshots(
    current: list[dict],
    baseline: list[dict],
    *,
    baseline_kind: str,
    baseline_path: str | None,
    coverage: CoverageReport | None = None,
    suspicious_pct: float = DEFAULT_SUSPICIOUS_PCT,
) -> DiffResult:
    coverage = coverage or CoverageReport()
    cur = _index_companies(current)
    base = _index_companies(baseline)
    result = DiffResult(
        baseline_kind=baseline_kind,
        baseline_path=baseline_path,
        baseline_size=len(base),
    )

    for key, c in cur.items():
        if key not in base:
            result.new_sponsors.append({
                "slug": key,
                "name": c.get("name"),
                "sources": sorted(_sources_of(c)),
                "publicUsd": c.get("publicUsd"),
                "in_catalog": False if baseline_kind == "catalog" else None,
            })
            continue
        b = base[key]

        # Like-with-like amount changes
        c_by = _amount_by_source(c)
        b_by = _amount_by_source(b)
        for src in ("oc", "osp", "own"):
            cu, bu = c_by.get(src), b_by.get(src)
            if cu is None or bu is None:
                continue
            try:
                cu_f, bu_f = float(cu), float(bu)
            except (TypeError, ValueError):
                continue
            if abs(cu_f - bu_f) >= 1.0:
                result.amount_changes.append({
                    "slug": key,
                    "name": c.get("name"),
                    "source": src,
                    "from": bu_f,
                    "to": cu_f,
                    "delta": round(cu_f - bu_f, 2),
                })
        # gh amounts almost never public — only compare when both sides have a real non-null figure
        cu, bu = c_by.get("gh"), b_by.get("gh")
        if cu is not None and bu is not None:
            try:
                cu_f, bu_f = float(cu), float(bu)
                if abs(cu_f - bu_f) >= 1.0:
                    result.amount_changes.append({
                        "slug": key,
                        "name": c.get("name"),
                        "source": "gh",
                        "from": bu_f,
                        "to": cu_f,
                        "delta": round(cu_f - bu_f, 2),
                    })
            except (TypeError, ValueError):
                pass

        cb = c.get("ghBeneficiaries")
        bb = b.get("ghBeneficiaries")
        if cb is not None and bb is not None and int(cb) != int(bb) and coverage.full("github_sponsors"):
            result.beneficiary_changes.append({
                "slug": key,
                "name": c.get("name"),
                "from": int(bb),
                "to": int(cb),
            })

        # Only diff sponsorship edges when the baseline carried a beneficiaries
        # list (weekly→weekly). Catalog baseline has none → would mark every
        # GH edge as "new" and flood the WFOSS Data bot.
        if isinstance(b.get("beneficiaries"), list):
            c_bens = {x.get("login") for x in (c.get("beneficiaries") or []) if x.get("login")}
            b_bens = {x.get("login") for x in (b.get("beneficiaries") or []) if x.get("login")}
            for login in sorted(c_bens - b_bens):
                result.new_sponsorships.append({"sponsor": key, "beneficiary": login})

    for key, b in base.items():
        if key in cur:
            continue
        sources = _sources_of(b)
        ok, missing = _coverage_allows_disappearance(sources, coverage)
        entry = {
            "slug": key,
            "name": b.get("name"),
            "publicUsd": b.get("publicUsd"),
            "sources": sorted(sources),
        }
        if ok:
            result.disappeared_sponsors.append(entry)
        else:
            entry["unverified_because"] = missing
            result.unverified_partial.append(entry)

    # Sanity threshold
    if result.baseline_size > 0:
        new_pct = 100.0 * len(result.new_sponsors) / result.baseline_size
        dis_pct = 100.0 * len(result.disappeared_sponsors) / result.baseline_size
        if new_pct > suspicious_pct:
            result.suspicious = True
            result.suspicious_reasons.append(
                f"new_sponsors {len(result.new_sponsors)} = {new_pct:.1f}% of baseline {result.baseline_size} (threshold {suspicious_pct}%)"
            )
        if dis_pct > suspicious_pct:
            result.suspicious = True
            result.suspicious_reasons.append(
                f"disappeared_sponsors {len(result.disappeared_sponsors)} = {dis_pct:.1f}% of baseline {result.baseline_size} (threshold {suspicious_pct}%)"
            )

    return result


def explain_new_against_catalog(new_sponsors: list[dict], catalog_path: Path) -> list[dict]:
    """Annotate remaining 'new' rows: confirm they are absent from catalog aliases."""
    if not catalog_path.exists():
        return new_sponsors
    index = build_catalog_index(catalog_path)
    out = []
    for row in new_sponsors:
        slug = row.get("slug") or ""
        resolved = index.resolve(login=slug, name=row.get("name"), site=None)
        hit = resolved in index.by_slug
        annotated = dict(row)
        annotated["catalog_resolve"] = resolved
        annotated["in_catalog"] = hit
        if hit:
            annotated["note"] = f"alias collision — should have merged to {resolved}"
        else:
            annotated["note"] = "absent from catalog.json (genuine new or below prior retention)"
        out.append(annotated)
    return out
