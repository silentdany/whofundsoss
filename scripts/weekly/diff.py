"""Diff a live weekly snapshot against the previous weekly file or the catalog."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class DiffResult:
    baseline_kind: str  # "weekly" | "catalog" | "none"
    baseline_path: str | None
    new_sponsors: list[dict] = field(default_factory=list)
    disappeared_sponsors: list[dict] = field(default_factory=list)
    new_sponsorships: list[dict] = field(default_factory=list)
    amount_changes: list[dict] = field(default_factory=list)
    beneficiary_changes: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "baseline_kind": self.baseline_kind,
            "baseline_path": self.baseline_path,
            "counts": {
                "new_sponsors": len(self.new_sponsors),
                "disappeared_sponsors": len(self.disappeared_sponsors),
                "new_sponsorships": len(self.new_sponsorships),
                "amount_changes": len(self.amount_changes),
                "beneficiary_changes": len(self.beneficiary_changes),
            },
            "new_sponsors": self.new_sponsors,
            "disappeared_sponsors": self.disappeared_sponsors,
            "new_sponsorships": self.new_sponsorships,
            "amount_changes": self.amount_changes,
            "beneficiary_changes": self.beneficiary_changes,
        }


def _index_companies(companies: list[dict]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for c in companies:
        key = (c.get("slug") or c.get("login") or c.get("name") or "").strip().lower()
        if not key:
            continue
        out[key] = c
    return out


def catalog_as_companies(catalog: dict) -> list[dict]:
    """Normalize published catalog.index into the weekly company shape."""
    rows = []
    for row in catalog.get("index") or []:
        rows.append({
            "slug": row.get("slug"),
            "name": row.get("name"),
            "site": row.get("site"),
            "login": row.get("slug"),
            "sources": list(row.get("sources") or []),
            "publicUsd": row.get("publicUsd"),
            "ghBeneficiaries": row.get("ghBeneficiaries"),
            "projects": row.get("projects"),
        })
    return rows


def load_baseline(weekly_dir: Path, catalog_path: Path) -> tuple[str, str | None, list[dict]]:
    weekly_dir.mkdir(parents=True, exist_ok=True)
    snapshots = sorted(weekly_dir.glob("????-??-??.json"))
    # Ignore a same-day file if we are regenerating
    if snapshots:
        path = snapshots[-1]
        data = json.loads(path.read_text(encoding="utf-8"))
        companies = data.get("companies") or []
        return "weekly", str(path), companies
    if catalog_path.exists():
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        return "catalog", str(catalog_path), catalog_as_companies(catalog)
    return "none", None, []


def diff_snapshots(current: list[dict], baseline: list[dict], *, baseline_kind: str, baseline_path: str | None) -> DiffResult:
    cur = _index_companies(current)
    base = _index_companies(baseline)
    result = DiffResult(baseline_kind=baseline_kind, baseline_path=baseline_path)

    for key, c in cur.items():
        if key not in base:
            result.new_sponsors.append({
                "slug": key,
                "name": c.get("name"),
                "sources": c.get("sources") or ([c["source"]] if c.get("source") else []),
                "publicUsd": c.get("publicUsd"),
            })
            continue
        b = base[key]
        # Amount change — only when both sides have a real number (not None).
        cu = c.get("publicUsd")
        bu = b.get("publicUsd")
        if cu is not None and bu is not None:
            try:
                cu_f = float(cu)
                bu_f = float(bu)
            except (TypeError, ValueError):
                cu_f = bu_f = None  # type: ignore
            if cu_f is not None and bu_f is not None and abs(cu_f - bu_f) >= 1.0:
                result.amount_changes.append({
                    "slug": key,
                    "name": c.get("name"),
                    "from": bu_f,
                    "to": cu_f,
                    "delta": round(cu_f - bu_f, 2),
                })
        # New GH beneficiaries vs baseline count
        cb = c.get("ghBeneficiaries")
        bb = b.get("ghBeneficiaries")
        if cb is not None and bb is not None and int(cb) != int(bb):
            result.beneficiary_changes.append({
                "slug": key,
                "name": c.get("name"),
                "from": int(bb),
                "to": int(cb),
            })
        # New sponsorship edges (beneficiary logins newly seen)
        c_bens = {x.get("login") for x in (c.get("beneficiaries") or []) if x.get("login")}
        b_bens = {x.get("login") for x in (b.get("beneficiaries") or []) if x.get("login")}
        for login in sorted(c_bens - b_bens):
            result.new_sponsorships.append({
                "sponsor": key,
                "beneficiary": login,
            })

    for key, b in base.items():
        if key not in cur:
            result.disappeared_sponsors.append({
                "slug": key,
                "name": b.get("name"),
                "publicUsd": b.get("publicUsd"),
            })

    return result
