#!/usr/bin/env python3
"""Rebuild catalog.json + two snapshot indexes from publishable dumps (s1, s2).

Does NOT read data/weekly/*.json. Source of truth = dump-public-*.json snapshots.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from weekly.normalize import CATALOG_SLUG_ALIASES, company_slug  # noqa: E402

SNAP = {
    "2026-10-05": Path("/workspace/wfoss-data/snapshots/2026-10-05"),
    "2026-10-06": Path("/workspace/wfoss-data/snapshots/2026-10-06"),
}
OUT_CATALOG = ROOT / "src/data/catalog.json"
OUT_SNAPS = ROOT / "src/data/snapshots"
WATCHLIST = ROOT / "src/data/watchlist.yml"

SOURCE = {
    "Open Collective": "oc",
    "Open Source Pledge": "osp",
    "GitHub Sponsors": "gh",
    "programme propre": "own",
}
PLATFORM_LABEL = {
    "Open Collective": "Open Collective",
    "Open Source Pledge": "Open Source Pledge",
    "GitHub Sponsors": "GitHub Sponsors",
    "programme propre": "programme propre",
    "oc": "Open Collective",
    "osp": "Open Source Pledge",
    "gh": "GitHub Sponsors",
    "own": "programme propre",
}
JUNK_SECTORS = {"", "OC backer", "découvert"}

# Pass-through platforms excluded from publishable entreprises (comparison.md).
PLATFORM_ORGS = {
    "open collective",
    "open collective foundation",
    "github sponsors",
    "open source collective",
}


def load_watchlist():
    items = []
    cur = None
    text = WATCHLIST.read_text()
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("- slug:"):
            if cur:
                items.append(cur)
            cur = {"slug": stripped.split(":", 1)[1].strip(), "reason": "", "added": ""}
        elif cur and stripped.startswith("reason:"):
            cur["reason"] = stripped.split(":", 1)[1].strip()
        elif cur and stripped.startswith("added:"):
            cur["added"] = stripped.split(":", 1)[1].strip()
    if cur:
        items.append(cur)
    return items


def resolve_slug(login: str | None, name: str | None, site: str | None) -> str:
    raw = company_slug(login=login, name=name, site=site)
    return CATALOG_SLUG_ALIASES.get(raw, raw)


def money_sources(projects):
    sums = {"oc": 0.0, "osp": 0.0, "gh": 0.0, "own": 0.0}
    for p in projects:
        key = SOURCE.get(p["platform"])
        if not key or p.get("total") is None:
            continue
        sums[key] += float(p["total"])
    return sums


def load_dump(snap_dir: Path):
    entreprises = json.loads((snap_dir / "dump-public-entreprises.json").read_text())
    sponsorings = json.loads((snap_dir / "dump-public-sponsorings.json").read_text())
    return entreprises, sponsorings


def build_companies(entreprises, sponsorings):
    # Group sponsorships by company name (exact dump key).
    by_co: dict[str, list] = defaultdict(list)
    for row in sponsorings:
        if row.get("exclusion_raison"):
            continue
        by_co[row["entreprise"]].append(row)

    companies: dict[str, dict] = {}
    for row in entreprises:
        if row.get("exclusion_raison"):
            continue
        name = (row.get("entreprise") or "").strip()
        if not name or name.lower() in PLATFORM_ORGS:
            continue
        login = (row.get("login_github") or "").strip() or None
        site = (row.get("site") or "").strip() or None
        slug = resolve_slug(login, name, site)
        if not slug:
            continue

        projects = []
        plateformes = set()
        for sp in by_co.get(name, []):
            plat_raw = (sp.get("plateforme") or "").strip()
            plat = PLATFORM_LABEL.get(plat_raw, plat_raw)
            if plat not in SOURCE and plat_raw in SOURCE:
                plat = PLATFORM_LABEL.get(plat_raw, plat_raw)
            # normalize known platforms
            for label in SOURCE:
                if plat_raw.lower() == label.lower() or plat.lower() == label.lower():
                    plat = label
                    break
            if plat not in SOURCE:
                # keep as own/programme if unknown? skip unknown platforms
                continue
            plateformes.add(plat)
            total = sp.get("montant_total")
            amount = None if total is None or total == "" else float(total)
            projects.append(
                {
                    "platform": plat,
                    "project": sp.get("beneficiaire") or "",
                    "total": amount,
                    "visibility": "public" if (sp.get("visibilite") or "").lower() == "public" else "hidden",
                }
            )

        # Prefer dump total; fall back to sum of sponsorships with amounts.
        usd = float(row.get("total_public_connu_usd") or 0)
        if usd <= 0 and projects:
            usd = sum(float(p["total"]) for p in projects if p.get("total") is not None)

        # Merge if slug collision (prefer higher usd / keep projects).
        if slug in companies:
            prev = companies[slug]
            if usd > float(prev.get("totalPublicUsd") or 0):
                prev["name"] = name
                prev["site"] = site
                prev["secteur"] = row.get("secteur") or prev.get("secteur")
                prev["totalPublicUsd"] = usd
                prev["beneficiairesGithub"] = int(row.get("nb_beneficiaires_github") or 0)
            # merge projects
            seen = {(p["platform"], p["project"]) for p in prev["projects"]}
            for p in projects:
                key = (p["platform"], p["project"])
                if key not in seen:
                    prev["projects"].append(p)
                    seen.add(key)
            plats = set((prev.get("plateformes") or "").split("|")) | plateformes
            plats.discard("")
            prev["plateformes"] = "|".join(sorted(plats))
            prev["projectsCount"] = len(prev["projects"])
            continue

        companies[slug] = {
            "name": name,
            "site": site,
            "secteur": row.get("secteur") or "",
            "totalPublicUsd": usd,
            "projectsCount": len(projects),
            "beneficiairesGithub": int(row.get("nb_beneficiaires_github") or 0),
            "plateformes": "|".join(sorted(plateformes)),
            "projects": projects,
        }
    return companies


def denylisted_slugs() -> set:
    """Spam-denylisted companies keep their row and page but never get a rank."""
    data = json.loads((ROOT / "src/data/public-spam-denylist.json").read_text())
    return {entry["slug"] for entry in data["entries"]}


def build_catalog(companies: dict, collected_at: str, exclusions_note: str, excl_counts: dict):
    deny = denylisted_slugs()
    ranked_slugs = sorted(
        (slug for slug in companies.keys() if slug not in deny),
        key=lambda s: (-float(companies[s].get("totalPublicUsd") or 0), companies[s].get("name", "").lower()),
    )
    # Top 200 non-denylisted companies by public $ get a rank (site convention).
    rank_of = {slug: i + 1 for i, slug in enumerate(ranked_slugs[:200])}

    max_usd = max((c.get("totalPublicUsd") or 0) for c in companies.values()) or 1
    index = []
    details = {}

    for slug, co in companies.items():
        projects = co.get("projects") or []
        sums = money_sources(projects)
        usd = float(co.get("totalPublicUsd") or 0)
        deduped = False
        raw_sum = sum(sums.values())
        if raw_sum > usd + 1 and abs((raw_sum - sums["own"]) - usd) < 1:
            sums["own"] = 0.0
            deduped = True

        itemized_with_amount = 0
        sponsorships = []
        for p in projects:
            key = SOURCE.get(p["platform"], "own")
            name = p.get("project") or ""
            aggregate = name.startswith("(agrégé")
            amount = None if p.get("total") is None else float(p["total"])
            if (
                not aggregate
                and key != "osp"
                and amount is not None
                and not (deduped and key == "own")
            ):
                itemized_with_amount += 1
            sponsorships.append(
                {
                    "project": name,
                    "source": key,
                    "amountUsd": amount,
                    "cumulative": key == "oc",
                    "visibility": "public" if p.get("visibility") == "public" else "hidden",
                    "aggregate": aggregate,
                }
            )

        projects_total = int(co.get("projectsCount") or 0)
        with_amount = min(itemized_with_amount, projects_total) if projects_total else 0
        coverage = (with_amount / projects_total) if projects_total else 0.0
        volume = usd / max_usd
        score = 0.6 * volume + 0.4 * coverage
        sector = co.get("secteur") or ""
        if sector in JUNK_SECTORS:
            sector = ""
        sources = []
        for label in (co.get("plateformes") or "").split("|"):
            key = SOURCE.get(label.strip())
            if key and key not in sources:
                sources.append(key)
        site = (co.get("site") or "").strip()
        if site and not site.startswith("http"):
            site = "https://" + site

        row = {
            "slug": slug,
            "name": co.get("name") or slug,
            "site": site or None,
            "sector": sector or None,
            "rank": rank_of.get(slug),
            "publicUsd": round(usd, 2),
            "projects": projects_total,
            "ghBeneficiaries": int(co.get("beneficiairesGithub") or 0),
            "sources": sources,
            "whale": usd >= 100_000,
            "transparency": round(score, 4),
            "volume": round(volume, 4),
            "coverage": round(coverage, 4),
            "projectsWithAmount": with_amount,
            "unitemized": usd > 0 and projects_total == 0,
            "lowVolume": usd < 25_000,
            "dedupedPledge": deduped,
        }
        index.append(row)
        details[slug] = {
            "bySource": {k: round(v, 2) for k, v in sums.items()},
            "sponsorships": sponsorships,
        }

    index.sort(key=lambda r: (-r["publicUsd"], r["name"].lower()))

    proj = defaultdict(set)
    for slug, co in companies.items():
        for p in co.get("projects") or []:
            name = p.get("project") or ""
            if name.startswith("(agrégé") or p.get("platform") == "programme propre":
                continue
            proj[name].add(slug)

    pair_projects = defaultdict(list)
    for name, slugs in proj.items():
        if not (2 <= len(slugs) <= 15):
            continue
        ordered = sorted(slugs)
        for i, a in enumerate(ordered):
            for b in ordered[i + 1 :]:
                if len(pair_projects[(a, b)]) < 8:
                    pair_projects[(a, b)].append(name)

    alliances = [
        {"a": a, "b": b, "shared": len(names), "projects": names}
        for (a, b), names in pair_projects.items()
        if len(names) >= 2
    ]
    alliances.sort(key=lambda e: -e["shared"])
    alliances = alliances[:40]

    by_slug = {r["slug"]: r for r in index}
    commons = []
    for name, slugs in sorted(proj.items(), key=lambda kv: -len(kv[1]))[:8]:
        funders = []
        for slug in slugs:
            co = companies[slug]
            amount = 0.0
            for p in co.get("projects") or []:
                if p.get("project") == name and p.get("total"):
                    amount += float(p["total"])
            if amount > 0:
                funders.append(
                    {
                        "slug": slug,
                        "name": by_slug[slug]["name"],
                        "amountUsd": round(amount, 2),
                    }
                )
        funders.sort(key=lambda f: -f["amountUsd"])
        commons.append(
            {
                "project": name,
                "sponsors": len(slugs),
                "funders": funders[:5],
            }
        )

    payload = {
        "meta": {
            "collectedAt": collected_at,
            "companies": len(index),
            "sponsorships": sum(len(d["sponsorships"]) for d in details.values()),
            "ranked": sum(1 for r in index if r["rank"]),
            "publicUsdRanked": round(sum(r["publicUsd"] for r in index if r["rank"]), 2),
            "publicUsdAll": round(sum(r["publicUsd"] for r in index), 2),
            "whales": sum(1 for r in index if r["whale"]),
            "maxPublicUsd": round(max_usd, 2),
            "cron": "snapshots 2026-10-05 → 2026-10-06 — weekly scraper ≠ catalog",
            "exclusions": {
                "spamCompanies": excl_counts["spam"],
                "spamUsd": excl_counts["spamUsd"],
                "selfFundCompanies": excl_counts["self"],
                "selfFundUsd": excl_counts["selfUsd"],
                "note": exclusions_note,
            },
        },
        "index": index,
        "details": details,
        "alliances": alliances,
        "commons": commons,
        "watchlist": load_watchlist(),
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    payload["meta"]["hash"] = hashlib.sha256(canonical).hexdigest()
    return payload


def exclusion_counts(entreprises):
    spam = self_ = 0
    spam_usd = self_usd = 0.0
    for r in entreprises:
        reason = (r.get("exclusion_raison") or "").strip()
        if not reason:
            continue
        usd = float(r.get("total_public_connu_usd") or 0)
        if reason.startswith("spam"):
            spam += 1
            spam_usd += usd
        elif "self" in reason:
            self_ += 1
            self_usd += usd
    return {
        "spam": spam,
        "spamUsd": round(spam_usd),
        "self": self_,
        "selfUsd": round(self_usd),
    }


def snapshot_index(payload: dict) -> dict:
    """Compact index for movements diff (no weekly files)."""
    return {
        "meta": {
            "collectedAt": payload["meta"]["collectedAt"],
            "hash": payload["meta"]["hash"],
            "companies": payload["meta"]["companies"],
            "sponsorships": payload["meta"]["sponsorships"],
            "ranked": payload["meta"]["ranked"],
            "publicUsdAll": payload["meta"]["publicUsdAll"],
            "publicUsdRanked": payload["meta"]["publicUsdRanked"],
        },
        "index": [
            {
                "slug": r["slug"],
                "name": r["name"],
                "rank": r["rank"],
                "publicUsd": r["publicUsd"],
                "projects": r["projects"],
                "ghBeneficiaries": r["ghBeneficiaries"],
            }
            for r in payload["index"]
        ],
    }


def main():
    OUT_SNAPS.mkdir(parents=True, exist_ok=True)
    payloads = {}
    for date, path in SNAP.items():
        entreprises, sponsorings = load_dump(path)
        companies = build_companies(entreprises, sponsorings)
        excl = exclusion_counts(entreprises)
        note = (
            f"Spam and self-fund already out of this file. Counts from dump {date} "
            f"(spam={excl['spam']}, self_fund={excl['self']})."
        )
        payload = build_catalog(companies, date, note, excl)
        payloads[date] = payload
        snap = snapshot_index(payload)
        out = OUT_SNAPS / f"{date}.json"
        out.write_text(json.dumps(snap, separators=(",", ":")))
        print(
            date,
            "companies",
            payload["meta"]["companies"],
            "usd",
            payload["meta"]["publicUsdAll"],
            "hash",
            payload["meta"]["hash"][:12],
            "→",
            out,
        )

    # Live catalog = snapshot 2, with prior snapshot pointers in meta.
    # Soft Sécu: hash MUST match the served file — set previous* THEN rehash, never mutate after.
    live = payloads["2026-10-06"]
    live["meta"].pop("hash", None)
    live["meta"]["previousCollectedAt"] = payloads["2026-10-05"]["meta"]["collectedAt"]
    live["meta"]["previousHash"] = payloads["2026-10-05"]["meta"]["hash"]
    # Never ship process notes on the public meta.
    live["meta"].pop("note_triage", None)
    canonical = json.dumps(live, sort_keys=True, separators=(",", ":")).encode()
    live["meta"]["hash"] = hashlib.sha256(canonical).hexdigest()
    OUT_CATALOG.write_text(json.dumps(live, separators=(",", ":")))
    print(
        "wrote",
        OUT_CATALOG,
        "bytes",
        OUT_CATALOG.stat().st_size,
        "hash",
        live["meta"]["hash"][:12],
        "prev",
        live["meta"]["previousHash"][:12],
    )


if __name__ == "__main__":
    main()
