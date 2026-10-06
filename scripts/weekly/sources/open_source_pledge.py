"""Open Source Pledge members — scrape the public members index + member pages.

No invented numbers: if a member page has no parseable annual payment, the
amount is left null (not 0). If the members index cannot be fetched, the whole
source is `unavailable`.
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
    """Extract name + best-effort annual payment. Null amount if unparseable."""
    title_m = re.search(r"<title>([^|<]+)", html, re.I)
    name = (title_m.group(1).strip() if title_m else slug).replace(" | Open Source Pledge", "").strip()
    # Prefer large round annual figures ($X,XXX or $XXX,XXX)
    amounts = []
    for m in re.finditer(r"\$([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})", html):
        try:
            amounts.append(int(m.group(1).replace(",", "")))
        except ValueError:
            continue
    # Heuristic: the largest amount on the page that looks like an annual total
    # (>= 1000). Never invent — if nothing parses, leave null.
    public_usd = None
    candidates = [a for a in amounts if a >= 1000]
    if candidates:
        public_usd = float(max(candidates))

    gh = None
    gh_m = re.search(r'href="https://github\.com/([A-Za-z0-9_.-]+)"', html)
    if gh_m:
        login = gh_m.group(1)
        if login.lower() not in {"opensourcepledge", "sponsors", "settings"}:
            gh = login

    site = None
    site_m = re.search(r'href="(https?://(?!opensourcepledge\.com|github\.com|twitter\.com|x\.com|linkedin\.com)[^"]+)"', html)
    if site_m:
        site = site_m.group(1)

    return {
        "slug": (gh or slug).lower(),
        "ospSlug": slug,
        "name": name,
        "login": gh,
        "site": site or f"https://opensourcepledge.com/members/{slug}/",
        "source": "osp",
        "sources": ["osp"],
        "publicUsd": public_usd,
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
    for slug in slugs:
        try:
            page = _get(f"https://opensourcepledge.com/members/{slug}/")
            items.append(parse_member_page(slug, page))
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
            "with_amount": sum(1 for i in items if i.get("publicUsd") is not None),
            "soft_errors": len(errors),
            "capped": max_members is not None,
        },
    )
