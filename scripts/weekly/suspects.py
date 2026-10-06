"""Keyword-based suspect flagging. FLAG only — never exclude.

Entries already on the spam denylist are marked `already_denylisted` so the
weekly report can skip or call them out without double-counting as new risks.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

# Broad keywords requested by CdP. Applied on name + login + site + sector.
SUSPECT_PATTERNS: dict[str, re.Pattern[str]] = {
    "casino": re.compile(r"casino|casin[oò]|kasino|gambling|\bpoker\b|\broulette\b|\bslots?\b|jackpot|bingo|bookmaker|sportsbook", re.I),
    "bet": re.compile(r"\bbet(?:ting|s)?\b|\bwager\b|vedonlyonti|gokken", re.I),
    "followers": re.compile(r"buy.?followers|followers.?buy|get.?followers|cheap.?followers", re.I),
    "likes": re.compile(r"buy.?likes|auto.?likes|instagram.?likes", re.I),
    "reviews": re.compile(r"buy.?reviews|fake.?reviews|google.?reviews", re.I),
    "traffic": re.compile(r"buy.?traffic|targeted.?traffic|website.?traffic|web.?traffic", re.I),
    "backlink": re.compile(r"buy.?backlinks?|backlink.?service|link.?building|\bpbn\b", re.I),
    "iptv": re.compile(r"\biptv\b|fire.?stick|sideload", re.I),
}

# Never flag these well-known funders even if a keyword substring matches.
LEGIT_ALLOW = {
    "getsentry",
    "sentry",
    "stripe",
    "vercel",
    "github",
    "microsoft",
    "shopify",
    "cloudflare",
    "automattic",
    "laravel",
    "posthog",
    "supabase",
    "coderabbitai",
    "sanity-io",
    "muxinc",
    "railway",
    "get-convex",
}


@dataclass(frozen=True)
class SuspectHit:
    slug: str
    name: str
    matched_keywords: tuple[str, ...]
    already_denylisted: bool
    text_sample: str


def flag_suspects(
    companies: list[dict],
    *,
    denylist_slugs: set[str] | None = None,
) -> list[SuspectHit]:
    """Return suspect hits. Does NOT filter companies out of any ranking."""
    denylist_slugs = denylist_slugs or set()
    hits: list[SuspectHit] = []
    for co in companies:
        slug = (co.get("slug") or co.get("login") or "").strip().lower()
        login = (co.get("login") or slug).strip().lower()
        if login in LEGIT_ALLOW or slug in LEGIT_ALLOW:
            continue
        name = (co.get("name") or "").strip()
        site = (co.get("site") or "").strip()
        sector = (co.get("sector") or "").strip()
        text = " ".join([name, login, slug, site, sector])
        matched = [kw for kw, pat in SUSPECT_PATTERNS.items() if pat.search(text)]
        if not matched:
            continue
        hits.append(
            SuspectHit(
                slug=slug or login or name.lower(),
                name=name or slug,
                matched_keywords=tuple(matched),
                already_denylisted=slug in denylist_slugs or login in denylist_slugs,
                text_sample=text[:160],
            )
        )
    return hits
