#!/usr/bin/env python3
"""Turn the publishable WhoFundsOSS JSON into one catalog the site and API share.

Run scripts/data/apply-denylist.py afterwards so spam never gets a rank.
"""

import hashlib
import json
from collections import defaultdict
from pathlib import Path

RAW = Path("/tmp/wfo")
OUT = Path("/workspace/src/data/catalog.json")

SOURCE = {
    "Open Collective": "oc",
    "Open Source Pledge": "osp",
    "GitHub Sponsors": "gh",
    "programme propre": "own",
}

JUNK_SECTORS = {"", "OC backer", "découvert"}


def load_watchlist():
    items = []
    cur = None
    text = Path("/workspace/src/data/watchlist.yml").read_text()
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
    sums = {"oc": 0.0, "osp": 0.0, "gh": 0.0, "own": 0.0}
    for p in projects:
        key = SOURCE.get(p["platform"])
        if not key or p.get("total") is None:
            continue
        sums[key] += float(p["total"])
    return sums


def money_sources(projects):
    sums = {"oc": 0.0, "osp": 0.0, "gh": 0.0, "own": 0.0}
    for p in projects:
        key = SOURCE.get(p["platform"])
        if not key or p.get("total") is None:
            continue
        sums[key] += float(p["total"])
    return sums


def main():
    companies = json.load(open(RAW / "companies.json"))
    ranking = json.load(open(RAW / "ranking.json"))
    rank_of = {row["slug"]: row["rank"] for row in ranking}

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

    # Distinctive co-sponsorships: projects with 2–15 sponsors, ignore aggregates and own programs.
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

    # Commons: hub collectives, biggest public checks.
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
            "collectedAt": "2026-10-05",
            "companies": len(index),
            "sponsorships": sum(len(d["sponsorships"]) for d in details.values()),
            "ranked": sum(1 for r in index if r["rank"]),
            "publicUsdRanked": round(sum(r["publicUsd"] for r in index if r["rank"]), 2),
            "publicUsdAll": round(sum(r["publicUsd"] for r in index), 2),
            "whales": sum(1 for r in index if r["whale"]),
            "maxPublicUsd": round(max_usd, 2),
            "cron": "baseline — next full collection is the 1st of the month",
            "exclusions": {
                "spamCompanies": 119,
                "spamUsd": 643728,
                "selfFundCompanies": 1,
                "selfFundUsd": 1097800,
                "note": "Spam and the Supabase self-fund are already out of this file. Counts are the 2026-10-05 method note, not recomputed here.",
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
    OUT.write_text(json.dumps(payload, separators=(",", ":")))
    print(
        "wrote",
        OUT,
        "bytes",
        OUT.stat().st_size,
        "companies",
        len(index),
        "alliances",
        len(alliances),
        "hash",
        payload["meta"]["hash"][:12],
    )


if __name__ == "__main__":
    main()
