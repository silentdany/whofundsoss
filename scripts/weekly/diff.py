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
    held: list[dict] = field(default_factory=list)
    renamed: list[dict] = field(default_factory=list)
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
                "held": len(self.held),
                "renamed": len(self.renamed),
            },
            "new_sponsors": self.new_sponsors,
            "disappeared_sponsors": self.disappeared_sponsors,
            "unverified_partial": self.unverified_partial,
            "new_sponsorships": self.new_sponsorships,
            "amount_changes": self.amount_changes,
            "beneficiary_changes": self.beneficiary_changes,
            "held": self.held,
            "renamed": self.renamed,
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
    def _rel(path: Path) -> str:
        try:
            # Prefer repo-relative path (never absolute runner path in reports).
            from pathlib import Path as _P
            root = _P(__file__).resolve().parents[2]
            return str(path.resolve().relative_to(root))
        except Exception:
            return path.name

    if snapshots:
        path = snapshots[-1]
        data = json.loads(path.read_text(encoding="utf-8"))
        return "weekly", _rel(path), data.get("companies") or []
    if catalog_path.exists():
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        return "catalog", _rel(catalog_path), catalog_as_companies(catalog)
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


def _entity_source_succeeded(
    src: str,
    baseline_company: dict,
    coverage: CoverageReport,
) -> bool:
    """True when this entity's covering source succeeded for that entity.

    Ignores the global success-ratio "full" flag — a company can be a verified
    disappearance when its own collectives/logins were fetched successfully.
    """
    key = SOURCE_FULL_KEY.get(src, src)
    meta = (coverage.sources.get(key) or {})
    if meta.get("status") != "ok":
        return False
    if meta.get("capped"):
        return False
    m = meta.get("meta") or {}
    if src == "oc":
        ok_slugs = set(m.get("ok_collective_slugs") or [])
        collectives = set(baseline_company.get("collectives") or [])
        if not collectives:
            # Catalog baseline may only have project counts — cannot verify per-entity.
            return False
        return bool(collectives) and collectives.issubset(ok_slugs)
    if src == "gh":
        ok_logins = {x.lower() for x in (m.get("ok_logins") or [])}
        login = (baseline_company.get("login") or baseline_company.get("slug") or "").lower()
        if not login:
            return False
        # If we track ok_logins, require membership; else fall back to source ok+uncapped.
        if ok_logins:
            return login in ok_logins
        return True
    if src == "osp":
        ok_members = set(m.get("ok_member_slugs") or [])
        osp = (baseline_company.get("ospSlug") or "").lower()
        if ok_members and osp:
            return osp in ok_members
        return True
    if src == "own":
        return False
    return True


def _coverage_allows_disappearance(
    baseline_sources: set[str],
    coverage: CoverageReport,
    baseline_company: dict | None = None,
) -> tuple[bool, list[str]]:
    """Verified disappeared only if every covering source succeeded for this entity."""
    if not baseline_sources:
        return False, ["unknown_sources"]
    company = baseline_company or {}
    missing = []
    for src in baseline_sources:
        if src == "own":
            missing.append("own")
            continue
        if not _entity_source_succeeded(src, company, coverage):
            missing.append(SOURCE_FULL_KEY.get(src, src))
    return (len(missing) == 0), missing


def stable_ids(company: dict) -> set[str]:
    """Slug-independent identity keys. Open Collective account slugs are stable."""
    ids = {f"oc:{a.strip().lower()}" for a in (company.get("ocAccounts") or []) if a and a.strip()}
    login = (company.get("login") or "").strip().lower()
    if login:
        ids.add(f"gh:{login}")
    osp = (company.get("ospSlug") or "").strip().lower()
    if osp:
        ids.add(f"osp:{osp}")
    return ids


def _matched_by(shared: set[str]) -> str:
    for prefix, label in (("oc:", "oc_account"), ("gh:", "gh_login"), ("osp:", "osp_slug")):
        if any(i.startswith(prefix) for i in shared):
            return label
    return "oc_site_name"


def _oc_fallback_id(company: dict) -> str | None:
    """For baselines written before ocAccounts existed: OC-only rows match on
    exact site domain + name (both must be present)."""
    if set(company.get("sources") or []) != {"oc"}:
        return None
    from .normalize import normalize_domain

    domain = normalize_domain(company.get("site"))
    name = (company.get("name") or "").strip().casefold()
    if not domain or not name:
        return None
    return f"ocsite:{domain}|{name}"


def match_renames(cur: dict[str, dict], base: dict[str, dict]) -> dict[str, str]:
    """Map baseline key -> current key for entities present under a new slug."""
    only_base = [k for k in base if k not in cur]
    only_cur = [k for k in cur if k not in base]
    if not only_base or not only_cur:
        return {}
    by_id: dict[str, list[str]] = {}
    for k in only_cur:
        keys = set(stable_ids(cur[k]))
        fb = _oc_fallback_id(cur[k])
        if fb:
            keys.add(fb)
        for i in keys:
            by_id.setdefault(i, []).append(k)
    out: dict[str, str] = {}
    taken: set[str] = set()
    for k in only_base:
        b = base[k]
        keys = stable_ids(b)
        if not (b.get("ocAccounts")):
            fb = _oc_fallback_id(b)
            if fb:
                keys = keys | {fb}
        hits = {c for i in keys for c in by_id.get(i, [])} - taken
        if len(hits) == 1:
            new_key = hits.pop()
            out[k] = new_key
            taken.add(new_key)
    return out


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

    # Stable identity: a company whose slug changed between runs (e.g. an
    # Open Collective org first slugged "unknown", now "sxl-cn") is the same
    # entity, not one disappearance plus one new sponsor.
    for old_key, new_key in match_renames(cur, base).items():
        b = base.pop(old_key)
        base[new_key] = b
        result.renamed.append({
            "from": old_key,
            "to": new_key,
            "name": cur[new_key].get("name"),
            "matchedBy": _matched_by(stable_ids(cur[new_key]) & stable_ids(b)),
        })

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
        ok, missing = _coverage_allows_disappearance(sources, coverage, b)
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

    # Round + sort amount changes by |delta| descending
    for row in result.amount_changes:
        row["from"] = round(float(row["from"]), 2)
        row["to"] = round(float(row["to"]), 2)
        row["delta"] = round(float(row["delta"]), 2)
    result.amount_changes.sort(key=lambda r: abs(float(r.get("delta") or 0)), reverse=True)

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


DEFAULT_HOLDS_CSV = Path(__file__).resolve().parents[2] / "data" / "holds" / "weekly-holds.csv"


HOLDS_HEADER = ("slug", "source", "reason", "decided_by", "since", "review_on")


class HoldsFileError(ValueError):
    """weekly-holds.csv is unusable: wrong header or at least one invalid row.

    The run must stop: a hold that cannot be read would otherwise let the
    disappearance it exists to prevent be published.
    """


def load_holds(path: Path | None = None) -> list[dict]:
    """Read data/holds/weekly-holds.csv. Missing file → no holds.

    - utf-8-sig so a BOM written by a spreadsheet editor is ignored;
    - header must be exactly HOLDS_HEADER;
    - every non-blank row needs the right number of columns, a slug and an
      ISO YYYY-MM-DD review_on;
    - parsed with csv.DictReader, so quoted fields may contain commas.

    Fails closed: an unreadable file (not UTF-8, a directory, an OS error),
    a wrong header or ANY invalid non-blank row raises
    HoldsFileError listing every problem with its line number. Fully blank
    rows (including ",,,,,") are ignored.
    """
    import csv
    from datetime import date

    path = path or DEFAULT_HOLDS_CSV
    if not path.exists():
        return []
    out: list[dict] = []
    errors: list[str] = []
    try:
        with path.open(encoding="utf-8-sig", newline="") as fh:
            reader = csv.DictReader(fh)
            header = tuple((h or "").strip() for h in (reader.fieldnames or []))
            if header != HOLDS_HEADER:
                raise HoldsFileError(
                    f"{path}: invalid header {list(header)!r}; expected {list(HOLDS_HEADER)!r}"
                )
            for row in reader:
                line = reader.line_num
                extra = row.pop(None, None)
                clean = {k.strip(): (v or "").strip() for k, v in row.items()}
                if not extra and not any(clean.values()):
                    continue
                label = f"line {line}" + (f" (slug {clean['slug']})" if clean.get("slug") else "")
                if extra or any(v is None for v in row.values()):
                    errors.append(
                        f"{label}: expected {len(HOLDS_HEADER)} columns "
                        "(quote the reason if it contains a comma)"
                    )
                    continue
                if not clean["slug"]:
                    errors.append(f"{label}: missing slug")
                    continue
                review_on = clean["review_on"]
                try:
                    ok = len(review_on) == 10 and date.fromisoformat(review_on).isoformat() == review_on
                except ValueError:
                    ok = False
                if not ok:
                    errors.append(f"{label}: review_on {review_on!r} is missing or not an ISO YYYY-MM-DD date")
                    continue
                out.append(clean)
    except UnicodeDecodeError as e:
        raise HoldsFileError(
            f"{path}: not valid UTF-8 (byte {e.start}: {e.reason}); "
            "save the file as UTF-8 (CSV UTF-8 in Excel)"
        ) from None
    except IsADirectoryError:
        raise HoldsFileError(f"{path}: is a directory, expected a CSV file") from None
    except OSError as e:
        raise HoldsFileError(f"{path}: cannot read ({e.strerror or e})") from None
    if errors:
        raise HoldsFileError(
            f"{path}: {len(errors)} invalid hold row(s); fix the file, nothing was published:\n  - "
            + "\n  - ".join(errors)
        )
    return out


ZERO_READINGS_TO_PUBLISH = 2
AUTO_HOLD_REASON = (
    "first zero reading; a disappearance is published only after "
    f"{ZERO_READINGS_TO_PUBLISH} consecutive zero readings"
)


def apply_holds(
    diff: DiffResult,
    companies: list[dict],
    baseline: list[dict],
    holds: list[dict],
    *,
    run_date: str,
    require_two_zero: bool = True,
) -> list[dict]:
    """Keep the last known record instead of publishing a disappearance.

    Two mechanisms, both carrying the baseline record forward (tagged `hold`)
    so the next run still has it in its baseline:

    - Manual holds (data/holds/weekly-holds.csv), active while run_date < review_on.
    - Generic rule (require_two_zero): a verified disappearance needs 2 consecutive
      zero readings. The first one is held automatically. If the baseline record
      already carries a `hold` (i.e. last week was already a zero reading) and no
      manual hold is active, the disappearance is published.

    Returns the (possibly extended) companies list; mutates diff
    (disappeared_sponsors -> held).
    """
    from .slug_aliases import slug_equivalents

    # A hold keyed on the old slug also covers the renamed one, and vice versa.
    active = {
        alias: h
        for h in holds
        if h.get("slug") and (not h.get("review_on") or run_date < h["review_on"])
        for alias in slug_equivalents(h["slug"])
    }
    if not active and not require_two_zero:
        return companies
    base = _index_companies(baseline)
    kept_disappeared = []
    out = list(companies)
    for row in diff.disappeared_sponsors:
        key = (row.get("slug") or "").lower()
        prev = base.get(key)
        hold = active.get(key)
        if prev is None:
            kept_disappeared.append(row)
            continue
        if hold is not None:
            tag = {
                "kind": "manual",
                "reason": hold.get("reason"),
                "since": hold.get("since"),
                "review_on": hold.get("review_on"),
            }
        elif require_two_zero and not prev.get("hold"):
            tag = {
                "kind": "zero_reading",
                "reason": AUTO_HOLD_REASON,
                "since": run_date,
                "review_on": None,
                "zeroReadings": 1,
            }
        else:
            # Second consecutive zero reading (or rule disabled): publish.
            kept_disappeared.append(row)
            continue
        carried = dict(prev)
        carried.pop("hold", None)
        tag["carriedFrom"] = diff.baseline_path
        carried["hold"] = tag
        out.append(carried)
        diff.held.append({**row, "hold_reason": tag["reason"], "review_on": tag["review_on"], "hold_kind": tag["kind"]})
    diff.disappeared_sponsors = kept_disappeared
    return out


DEFAULT_SITE_OVERRIDES = Path(__file__).resolve().parents[2] / "data" / "overrides" / "site-overrides.json"


def load_site_overrides(path: Path | None = None) -> dict[str, str]:
    """Read data/overrides/site-overrides.json ({slug: site}). Missing file → {}.
    Keys starting with "_" are comments. Fails closed on invalid content."""
    path = path or DEFAULT_SITE_OVERRIDES
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError(f"{path}: expected a JSON object {{slug: site}}")
    out: dict[str, str] = {}
    for k, v in raw.items():
        if k.startswith("_"):
            continue
        if not isinstance(v, str) or not v.startswith(("https://", "http://")):
            raise ValueError(f"{path}: site for {k!r} must be an http(s) URL, got {v!r}")
        out[k.lower()] = v
    return out


def apply_site_overrides(companies: list[dict], overrides: dict[str, str]) -> list[dict]:
    """Force the configured site on matching slugs (old/new slug aliases included)."""
    if not overrides:
        return companies
    from .slug_aliases import slug_equivalents

    expanded = {alias.lower(): site for slug, site in overrides.items() for alias in slug_equivalents(slug)}
    for c in companies:
        site = expanded.get((c.get("slug") or "").lower())
        if site:
            c["site"] = site
    return companies


DROP_READINGS_TO_PUBLISH = 2
DROP_RATIO = 0.5  # a drop of more than 50% of a count needs confirmation
DROP_HOLD_REASON = (
    f"count dropped by more than {int(DROP_RATIO * 100)}%; published only after "
    f"{DROP_READINGS_TO_PUBLISH} consecutive readings"
)


def _ben_count(rec: dict) -> int | None:
    v = rec.get("ghBeneficiaries")
    if v is None:
        bens = rec.get("beneficiaries")
        return len(bens) if isinstance(bens, list) else None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def apply_drop_confirmation(
    diff: DiffResult,
    companies: list[dict],
    baseline: list[dict],
    *,
    run_date: str,
) -> list[dict]:
    """Extend the two-zero-readings rule to sharp drops.

    If a sponsor's beneficiary count falls by more than DROP_RATIO versus the
    baseline (and is not zero, which apply_holds already covers), the previous
    value is kept and tagged `pendingDrop`. If the baseline record already
    carries `pendingDrop` (last week was the first low reading) and the drop
    is still >50% of the last published value, the new value is published.
    Mutates companies in place and diff (beneficiary_changes -> held).
    """
    base = _index_companies(baseline)
    held_slugs: set[str] = set()
    for c in companies:
        key = (c.get("slug") or "").lower()
        prev = base.get(key)
        if prev is None or c.get("hold"):
            continue
        before, now = _ben_count(prev), _ben_count(c)
        c.pop("pendingDrop", None)
        if not before or now is None or now == 0 or now >= before * (1 - DROP_RATIO):
            continue
        if prev.get("pendingDrop"):
            continue  # second consecutive sharp-drop reading: publish
        c["pendingDrop"] = {
            "field": "ghBeneficiaries",
            "from": before,
            "to": now,
            "since": run_date,
            "readings": 1,
            "reason": DROP_HOLD_REASON,
            "carriedFrom": diff.baseline_path,
        }
        c["ghBeneficiaries"] = prev.get("ghBeneficiaries")
        c["beneficiaries"] = prev.get("beneficiaries")
        held_slugs.add(key)
        diff.held.append({
            "slug": c.get("slug"),
            "name": c.get("name"),
            "from": before,
            "to": now,
            "hold_reason": DROP_HOLD_REASON,
            "review_on": None,
            "hold_kind": "sharp_drop",
        })
    if held_slugs:
        diff.beneficiary_changes = [
            r for r in diff.beneficiary_changes if (r.get("slug") or "").lower() not in held_slugs
        ]
        diff.new_sponsorships = [
            r for r in diff.new_sponsorships if (r.get("sponsor") or "").lower() not in held_slugs
        ]
    return companies
