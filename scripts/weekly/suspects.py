"""Keyword-based suspect flagging. FLAG only — never exclude.

Matches against slug, login, site, sector, AND the unicode `name` (NFKC,
case-insensitive). Entries already on the spam denylist are marked
`already_denylisted` so the weekly report can call them out without treating
them as new risks.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

# Broad keywords. Applied on NFKC-normalized name + login + slug + site + sector.
SUSPECT_PATTERNS: dict[str, re.Pattern[str]] = {
    "casino": re.compile(
        r"casino|casin[oò]|kasino|gambling|\bpoker\b|\broulette\b|\bslots?\b|jackpot|bingo|"
        r"bookmaker|sportsbook|bao.?casino|\baviator\b|1win|spin-?paradise",
        re.I,
    ),
    "bet": re.compile(r"\bbet(?:ting|s)?\b|\bwager\b|vedonlyonti|gokken", re.I),
    "followers": re.compile(r"buy.?followers|followers.?buy|get.?followers|cheap.?followers", re.I),
    "likes": re.compile(r"buy.?likes|auto.?likes|instagram.?likes", re.I),
    "reviews": re.compile(r"buy.?reviews|fake.?reviews|google.?reviews", re.I),
    "traffic": re.compile(r"buy.?traffic|targeted.?traffic|website.?traffic|web.?traffic", re.I),
    "backlink": re.compile(r"buy.?backlinks?|backlink.?service|link.?building|\bpbn\b", re.I),
    "iptv": re.compile(r"\biptv\b|fire.?stick|sideload", re.I),
    # Non-Latin / regional (unicode name)
    "thai_gambling": re.compile(r"พนัน|คาสิโน|สล็อต|บาคาร่า|หวย"),
    "cyrillic_gambling": re.compile(r"казино|ставки|букмекер|слот|ігров|игровые|рулетк|лотере", re.I),
    "vietnamese_gambling": re.compile(r"cá độ|cược|đánh bạc|xổ số", re.I),
    "indonesian_gambling": re.compile(r"\bjudi\b|kasino|slot online|\btogel\b", re.I),
    # SEO / essay mills
    "essay_seo": re.compile(r"link.?building|essay.?writ|write.?my.?essay|\bessay\b|homework|dissertation|writers.?per.?hour", re.I),
}

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


def _norm(text: str) -> str:
    """NFKC normalize; keep casefold for Latin, preserve non-Latin for regex."""
    return unicodedata.normalize("NFKC", text or "").casefold()


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
        # Raw (for unicode-aware patterns) + NFKC casefold (for Latin)
        raw = " ".join([name, login, slug, site, sector])
        folded = _norm(raw)
        matched: list[str] = []
        for kw, pat in SUSPECT_PATTERNS.items():
            # Search both folded and raw so unicode literals still hit
            if pat.search(folded) or pat.search(raw):
                matched.append(kw)
        if not matched:
            continue
        hits.append(
            SuspectHit(
                slug=slug or login or name.lower(),
                name=name or slug,
                matched_keywords=tuple(matched),
                already_denylisted=slug in denylist_slugs or login in denylist_slugs,
                text_sample=raw[:160],
            )
        )
    return hits
