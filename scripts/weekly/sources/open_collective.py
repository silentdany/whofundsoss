"""Open Collective organization backers (public JSON, no auth).

`members/organizations.json` returns one row per membership (distinct MemberId),
each repeating the same org-level `totalAmountDonated` for that collective.
We dedupe by (collective, org) and take the total once — never sum duplicate rows.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from .base import SourceResult

UA = {"User-Agent": "whofundsoss-weekly-scraper/0.1 (public research; +https://github.com/silentdany/whofundsoss)"}

# Ported (deduped) from recherche/github_sponsors/collect.py
OC_COLLECTIVES = sorted({
    "webpack", "babel", "eslint", "vuejs", "vite", "vitest", "nuxtjs",
    "storybook", "prettier", "jest", "mochajs", "typescript-eslint",
    "rollup", "parcel", "svelte", "preact", "tailwindcss", "astrojs",
    "fastify", "expressjs", "nestjs", "electron", "homebrew", "godot",
    "mastodon", "jellyfin", "syncthing", "ohmyzsh", "neovim",
    "docusaurus", "gatsbyjs", "mui-org", "chakra-ui", "three-js", "core-js",
    "nodemon", "socketio", "opencollective", "lodash", "moment", "jquery",
    "bootstrap", "react", "emberjs", "angular", "nextjs", "remix-run",
    "solidjs", "qwik", "lit", "nx", "pnpm", "yarnpkg",
    "cypress-io", "playwright", "puppeteer",
    "swagger", "graphql", "hasura", "supabase", "appwrite", "strapi",
    "directus", "n8n", "posthog", "plausible", "umami",
    "sentry", "grafana", "prometheus", "kubernetes", "cncf",
    "ffmpeg", "obsproject", "blender", "inkscape", "gimp",
    "rust", "zig", "elixir", "phoenixframework",
    "django", "flask", "fastapi", "pydantic", "sqlalchemy",
    "rails", "laravel", "symfony", "wordpress",
    "brave", "mozilla", "kde", "gnome",
    "codecov", "algolia", "meilisearch", "typesense",
    "digitalocean", "heroku", "netlify", "vercel", "shopify", "stripe",
})


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _oc_slug_from_profile(profile: str | None, slug_field: str | None) -> str | None:
    if slug_field and str(slug_field).strip():
        return str(slug_field).strip().lower()
    if not profile:
        return None
    try:
        path = urlparse(profile).path.strip("/")
    except Exception:
        return None
    if not path:
        return None
    return path.split("/")[0].lower() or None


def _org_key(m: dict[str, Any]) -> str:
    """Stable org identity within a collective (for dedupe)."""
    github = None
    gh_field = m.get("github")
    if isinstance(gh_field, str) and "github.com/" in gh_field:
        github = gh_field.rstrip("/").split("/")[-1].lower()
    oc_slug = _oc_slug_from_profile(m.get("profile"), m.get("slug"))
    name = (m.get("name") or "").strip().lower()
    return github or oc_slug or name


def fetch_oc_org_backers(slug: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Return (usd_backers, non_usd_rows). Dedupe by org key within this collective."""
    url = f"https://opencollective.com/{slug}/members/organizations.json?limit=1000"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())
    if not isinstance(data, list):
        raise ValueError(f"unexpected OC payload for {slug}")

    by_org: dict[str, dict[str, Any]] = {}
    non_usd: list[dict[str, Any]] = []

    for m in data:
        if not isinstance(m, dict):
            continue
        role = (m.get("role") or "").upper()
        if role in {"HOST", "ADMIN", "MEMBER"} and (m.get("totalAmountDonated") or 0) == 0:
            continue
        name = (m.get("name") or "").strip()
        if not name:
            continue
        key = _org_key(m)
        if not key:
            continue

        github = None
        gh_field = m.get("github")
        if isinstance(gh_field, str) and "github.com/" in gh_field:
            github = gh_field.rstrip("/").split("/")[-1]

        oc_slug = _oc_slug_from_profile(m.get("profile"), m.get("slug"))
        currency = (m.get("currency") or "USD").strip().upper() or "USD"
        amount = m.get("totalAmountDonated")
        amount_f = float(amount) if amount is not None else None

        # Prefer a real company website over the OC profile URL (avoids generic-host aliasing).
        website = m.get("website")
        site = website if website else None

        row = {
            "name": name,
            "slug": (github or oc_slug or name).lower().replace(" ", "-"),
            "ocSlug": oc_slug or None,
            "login": github,
            "site": site,
            "source": "oc",
            "collective": slug,
            "publicUsd": amount_f if currency == "USD" else None,
            "amount": amount_f,
            "currency": currency,
            "role": role or None,
            "isActive": bool(m.get("isActive")),
            "memberId": m.get("MemberId"),
        }

        if currency != "USD":
            non_usd.append({
                "collective": slug,
                "orgKey": key,
                "name": name,
                "ocSlug": oc_slug,
                "amount": amount_f,
                "currency": currency,
            })
            # Still register org presence for collective count, but do not add non-USD into USD totals.
            if key not in by_org:
                by_org[key] = {**row, "publicUsd": None, "currency": currency}
            continue

        # Dedupe: first row wins; totalAmountDonated is org-level and identical across memberships.
        if key in by_org:
            continue
        by_org[key] = row

    return list(by_org.values()), non_usd


def fetch_open_collective(
    *,
    collectives: list[str] | None = None,
    max_collectives: int | None = None,
) -> SourceResult:
    fetched_at = _now()
    targets = list(collectives) if collectives is not None else list(OC_COLLECTIVES)
    if max_collectives is not None:
        targets = targets[:max_collectives]

    # Aggregate by company key across collectives: sum USD once per (collective, org).
    by_key: dict[str, dict] = {}
    errors: list[str] = []
    ok_collectives = 0
    ok_collective_slugs: list[str] = []
    non_usd_all: list[dict] = []
    dup_skipped = 0

    for slug in targets:
        try:
            backers, non_usd = fetch_oc_org_backers(slug)
            ok_collectives += 1
            ok_collective_slugs.append(slug)
            non_usd_all.extend(non_usd)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                continue
            errors.append(f"{slug}: HTTP {e.code}")
            continue
        except Exception as e:
            errors.append(f"{slug}: {e}")
            continue

        for b in backers:
            key = (b.get("login") or b.get("ocSlug") or b["name"]).lower()
            cur = by_key.get(key)
            if cur is None:
                by_key[key] = {
                    "slug": key,
                    "ocSlug": b.get("ocSlug"),
                    "name": b["name"],
                    "login": b.get("login"),
                    "site": b.get("site"),
                    "source": "oc",
                    "sources": ["oc"],
                    "publicUsd": float(b["publicUsd"]) if b.get("publicUsd") is not None else None,
                    "collectives": [b["collective"]],
                    "ocActive": bool(b.get("isActive")),
                    "currency": "USD",
                }
            else:
                # New collective contribution — add once (already deduped within collective).
                if b["collective"] not in cur["collectives"]:
                    cur["collectives"].append(b["collective"])
                    if b.get("publicUsd") is not None:
                        cur["publicUsd"] = round((cur.get("publicUsd") or 0) + float(b["publicUsd"]), 2)
                else:
                    dup_skipped += 1
                if not cur.get("login") and b.get("login"):
                    cur["login"] = b["login"]
                if not cur.get("ocSlug") and b.get("ocSlug"):
                    cur["ocSlug"] = b["ocSlug"]
                if not cur.get("site") and b.get("site"):
                    cur["site"] = b["site"]
        time.sleep(0.05)

    if ok_collectives == 0:
        return SourceResult(
            name="open_collective",
            status="unavailable",
            error="; ".join(errors[:5]) or "all collectives failed",
            fetched_at=fetched_at,
            meta={"attempted": len(targets), "errors": len(errors)},
        )

    items = list(by_key.values())
    # Round USD totals
    for it in items:
        if it.get("publicUsd") is not None:
            it["publicUsd"] = round(float(it["publicUsd"]), 2)

    return SourceResult(
        name="open_collective",
        status="ok",
        items=items,
        fetched_at=fetched_at,
        meta={
            "attempted": len(targets),
            "ok_collectives": ok_collectives,
            "ok_collective_slugs": ok_collective_slugs,
            "companies": len(items),
            "soft_errors": len(errors),
            "capped": max_collectives is not None,
            "universe": len(OC_COLLECTIVES),
            "non_usd_count": len(non_usd_all),
            "non_usd": non_usd_all[:200],
            "dup_membership_rows_skipped": dup_skipped,
        },
    )
