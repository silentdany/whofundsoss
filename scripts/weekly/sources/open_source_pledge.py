"""Open Source Pledge members — scrape the public members index + member pages.

Amount rule: take the MOST RECENT annual report year on the page (not the page
max). If unparseable, leave null — never invent.
"""
from __future__ import annotations

import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any

from .base import SourceResult

UA = {"User-Agent": "whofundsoss-weekly-scraper/0.1 (public research; +https://github.com/silentdany/whofundsoss)"}
MEMBERS_URL = "https://opensourcepledge.com/members/"


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _get(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def list_member_slugs(html: str) -> list[str]:
    slugs = re.findall(r'href="/members/([a-z0-9][a-z0-9\-]*)/?', html)
    out: list[str] = []
    seen: set[str] = set()
    for s in slugs:
        if s in seen:
            continue
        seen.add(s)
        out.append(s)
    return out


def parse_member_page(slug: str, html: str) -> dict[str, Any]:
    """Extract name + annual payment from the most recent report year."""
    title_m = re.search(r"<title>([^|<]+)", html, re.I)
    name = (title_m.group(1).strip() if title_m else slug).replace(" | Open Source Pledge", "").strip()

    # Split into annual-report sections; pick the highest year.
    year_amounts: dict[int, list[int]] = {}
    sections = re.split(r'<section[^>]*class="[^"]*annual-report', html, flags=re.I)
    for sec in sections[1:] if len(sections) > 1 else []:
        year_m = re.search(r">(20[12][0-9])\s*report", sec, re.I)
        if not year_m:
            continue
        year = int(year_m.group(1))
        amounts: list[int] = []
        for m in re.finditer(r"\$([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})", sec):
            try:
                amounts.append(int(m.group(1).replace(",", "")))
            except ValueError:
                continue
        candidates = [a for a in amounts if a >= 1000]
        if candidates:
            year_amounts[year] = candidates

    public_usd = None
    report_year = None
    if year_amounts:
        report_year = max(year_amounts)
        # Within the latest year, the annual total is the largest figure.
        public_usd = float(max(year_amounts[report_year]))
    else:
        # Fallback: no section structure — leave null rather than inventing from page max.
        public_usd = None

    gh = None
    gh_m = re.search(r'href="https://github\.com/([A-Za-z0-9_.-]+)"', html)
    if gh_m:
        login = gh_m.group(1)
        if login.lower() not in {"opensourcepledge", "sponsors", "settings"}:
            gh = login

    site = None
    site_m = re.search(
        r'href="(https?://(?!opensourcepledge\.com|github\.com|twitter\.com|x\.com|linkedin\.com)[^"]+)"',
        html,
    )
    if site_m:
        site = site_m.group(1)

    return {
        "slug": (gh or slug).lower(),
        "ospSlug": slug,
        "name": name,
        "login": gh,
        "site": site or None,  # avoid opensourcepledge.com generic host
        "source": "osp",
        "sources": ["osp"],
        "publicUsd": round(public_usd, 2) if public_usd is not None else None,
        "ospReportYear": report_year,
        "reportUrl": f"https://opensourcepledge.com/members/{slug}/",
    }


def fetch_open_source_pledge(*, max_members: int | None = None) -> SourceResult:
    fetched_at = _now()
    try:
        index_html = _get(MEMBERS_URL)
    except Exception as e:
        return SourceResult(
            name="open_source_pledge",
            status="unavailable",
            error=str(e)[:400],
            fetched_at=fetched_at,
        )

    slugs = list_member_slugs(index_html)
    if not slugs:
        return SourceResult(
            name="open_source_pledge",
            status="unavailable",
            error="members index parsed 0 slugs",
            fetched_at=fetched_at,
        )
    if max_members is not None:
        slugs = slugs[:max_members]

    items: list[dict] = []
    errors: list[str] = []
    ok_member_slugs: list[str] = []
    for slug in slugs:
        try:
            page = _get(f"https://opensourcepledge.com/members/{slug}/")
            items.append(parse_member_page(slug, page))
            ok_member_slugs.append(slug)
        except urllib.error.HTTPError as e:
            errors.append(f"{slug}: HTTP {e.code}")
        except Exception as e:
            errors.append(f"{slug}: {e}")
        time.sleep(0.1)

    if not items:
        return SourceResult(
            name="open_source_pledge",
            status="unavailable",
            error="; ".join(errors[:5]) or "no members fetched",
            fetched_at=fetched_at,
            meta={"index_slugs": len(slugs)},
        )

    return SourceResult(
        name="open_source_pledge",
        status="ok",
        items=items,
        fetched_at=fetched_at,
        meta={
            "index_slugs": len(slugs),
            "fetched": len(items),
            "ok_member_slugs": ok_member_slugs,
            "with_amount": sum(1 for i in items if i.get("publicUsd") is not None),
            "soft_errors": len(errors),
            "capped": max_members is not None,
        },
    )
