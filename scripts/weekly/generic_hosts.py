"""Versioned list of generic website hosts that must NEVER be used for entity aliasing.

When a catalog row (or OC member) has site=https://opencollective.com/... or
github.com / medium.com / trustpilot.com / …, registering that host as an alias
collapses unrelated entities into one slug (see QA alias-collision.txt).

VERSION bumps when the list changes so reports can cite it.
"""
from __future__ import annotations

GENERIC_HOSTS_VERSION = "2026-10-06.1"

# Exact registrable hosts (lowercase, no www.). Matching is exact-domain only.
GENERIC_HOSTS: frozenset[str] = frozenset({
    "opencollective.com",
    "github.com",
    "gist.github.com",
    "medium.com",
    "trustpilot.com",
    "linkedin.com",
    "twitter.com",
    "x.com",
    "facebook.com",
    "fb.com",
    "instagram.com",
    "youtube.com",
    "youtu.be",
    "tiktok.com",
    "reddit.com",
    "wikipedia.org",
    "en.wikipedia.org",
    "google.com",
    "docs.google.com",
    "bit.ly",
    "t.co",
    "linktr.ee",
    "notion.so",
    "notion.site",
    "substack.com",
    "discord.com",
    "discord.gg",
    "telegram.me",
    "t.me",
    "patreon.com",
    "buymeacoffee.com",
    "ko-fi.com",
    "opensourcepledge.com",
    "npmjs.com",
    "pypi.org",
    "crates.io",
    "hub.docker.com",
})


def is_generic_host(host: str | None) -> bool:
    if not host:
        return False
    h = host.strip().lower().removeprefix("www.")
    if h in GENERIC_HOSTS:
        return True
    # Also treat bare multi-label trustpilot review hosts as generic hubs
    # e.g. de.trustpilot.com, nl.trustpilot.com
    if h.endswith(".trustpilot.com") or h.endswith(".linkedin.com"):
        return True
    return False
