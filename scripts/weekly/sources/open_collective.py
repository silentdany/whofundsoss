"""Open Collective organization backers (public JSON, no auth)."""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any

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


def fetch_oc_org_backers(slug: str) -> list[dict[str, Any]]:
    url = f"https://opencollective.com/{slug}/members/organizations.json?limit=1000"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())
    if not isinstance(data, list):
        raise ValueError(f"unexpected OC payload for {slug}")
    out = []
    for m in data:
        if not isinstance(m, dict):
            continue
        role = (m.get("role") or "").upper()
        # Keep BACKER / sponsor-like roles; skip HOST fiscal hosts as "funders"
        if role in {"HOST", "ADMIN", "MEMBER"} and (m.get("totalAmountDonated") or 0) == 0:
            continue
        name = (m.get("name") or "").strip()
        if not name:
            continue
        github = None
        gh_field = m.get("github")
        if isinstance(gh_field, str) and "github.com/" in gh_field:
            github = gh_field.rstrip("/").split("/")[-1]
        out.append({
            "name": name,
            "slug": (m.get("slug") or name).lower().replace(" ", "-"),
            "login": github,
            "site": m.get("website") or m.get("profile"),
            "source": "oc",
            "collective": slug,
            "publicUsd": float(m["totalAmountDonated"]) if m.get("totalAmountDonated") is not None else None,
            "role": role or None,
            "isActive": bool(m.get("isActive")),
        })
    return out


def fetch_open_collective(
    *,
    collectives: list[str] | None = None,
    max_collectives: int | None = None,
) -> SourceResult:
    fetched_at = _now()
    targets = list(collectives) if collectives is not None else list(OC_COLLECTIVES)
    if max_collectives is not None:
        targets = targets[:max_collectives]

    # Aggregate by company key (prefer github login, else slug)
    by_key: dict[str, dict] = {}
    errors: list[str] = []
    ok_collectives = 0

    for slug in targets:
        try:
            backers = fetch_oc_org_backers(slug)
            ok_collectives += 1
        except urllib.error.HTTPError as e:
            if e.code == 404:
                continue
            errors.append(f"{slug}: HTTP {e.code}")
            continue
        except Exception as e:
            errors.append(f"{slug}: {e}")
            continue
        for b in backers:
            key = (b.get("login") or b.get("slug") or b["name"]).lower()
            cur = by_key.get(key)
            if cur is None:
                by_key[key] = {
                    "slug": key,
                    "name": b["name"],
                    "login": b.get("login"),
                    "site": b.get("site"),
                    "source": "oc",
                    "sources": ["oc"],
                    "publicUsd": b.get("publicUsd") or 0.0,
                    "collectives": [b["collective"]],
                    "ocActive": bool(b.get("isActive")),
                }
            else:
                if b.get("publicUsd"):
                    cur["publicUsd"] = (cur.get("publicUsd") or 0) + float(b["publicUsd"])
                if b["collective"] not in cur["collectives"]:
                    cur["collectives"].append(b["collective"])
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
    return SourceResult(
        name="open_collective",
        status="ok",
        items=items,
        fetched_at=fetched_at,
        meta={
            "attempted": len(targets),
            "ok_collectives": ok_collectives,
            "companies": len(items),
            "soft_errors": len(errors),
        },
    )
