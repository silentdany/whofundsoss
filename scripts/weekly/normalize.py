"""Catalog-aligned slug normalization and identity resolution.

Catalog rule (from the publishable → build-catalog pipeline):
  slug = login_github.lower()  if login_github else slugify(entreprise_name)

Non-ASCII names without a login fall back to a site-host slug when possible.
This module also builds an alias index from `src/data/catalog.json` so weekly
rows resolve to the same slug the site already uses (e.g. OSP `sentry` →
`getsentry`, name variants → catalog slug).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

# Known OSP member slug → catalog slug (when GH login differs from OSP path).
OSP_SLUG_ALIASES: dict[str, str] = {
    "sentry": "getsentry",
    "posit": "posit-dev",
    "sanity": "sanity-io",
    "coderabbit": "coderabbitai",
    "mux": "muxinc",
    "convex": "get-convex",
    "astral": "astral-sh",
    "gitbook": "gitbookio",
    "frontend-masters": "frontendmasters",
    "gitbutler": "gitbutlerapp",
    "http-toolkit": "httptoolkit",
    "pydantic": "pydantic",
    "private-packagist": "packagist",
    "val-town": "val-town",
    "codecrafters": "codecrafters-io",
    "speakeasy": "speakeasy-api",
    "vlt": "vltpkg",
    "keygen": "keygen-sh",
}


def slugify(text: str) -> str:
    """ASCII kebab-case, same spirit as the catalog name→slug path."""
    s = (text or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def host_slug(site: str | None) -> str:
    if not site:
        return ""
    raw = site.strip()
    if not raw.startswith("http"):
        raw = "https://" + raw
    try:
        host = urlparse(raw).hostname or ""
    except Exception:
        host = ""
    host = host.lower().removeprefix("www.")
    return slugify(host) if host else ""


def company_slug(*, login: str | None = None, name: str | None = None, site: str | None = None) -> str:
    """Primary slug used when no catalog alias hits."""
    login_l = (login or "").strip().lower()
    if login_l:
        return login_l
    name_slug = slugify(name or "")
    if name_slug:
        return name_slug
    return host_slug(site)


@dataclass
class CatalogIndex:
    """Maps many identity keys → canonical catalog slug."""

    by_slug: dict[str, dict] = field(default_factory=dict)
    aliases: dict[str, str] = field(default_factory=dict)  # any key → catalog slug
    by_source: dict[str, dict[str, float]] = field(default_factory=dict)  # slug → {oc,osp,gh,own}

    def resolve(
        self,
        *,
        login: str | None = None,
        name: str | None = None,
        site: str | None = None,
        osp_slug: str | None = None,
        oc_slug: str | None = None,
    ) -> str:
        candidates: list[str] = []
        if login:
            candidates.append(login.strip().lower())
        if osp_slug:
            osp = osp_slug.strip().lower()
            candidates.append(OSP_SLUG_ALIASES.get(osp, osp))
            candidates.append(osp)
        if oc_slug:
            candidates.append(oc_slug.strip().lower())
        if name:
            candidates.append(slugify(name))
        hs = host_slug(site)
        if hs:
            candidates.append(hs)
            # icons8-com style → try without TLD chunks already in slugify of host
            parts = hs.split("-")
            if len(parts) >= 2 and parts[-1] in {"com", "org", "net", "io", "co", "ai", "dev", "app"}:
                candidates.append("-".join(parts[:-1]))

        for key in candidates:
            if not key:
                continue
            if key in self.aliases:
                return self.aliases[key]
            if key in self.by_slug:
                return key

        return company_slug(login=login, name=name, site=site)

    def get(self, slug: str) -> dict | None:
        return self.by_slug.get(slug)


def build_catalog_index(catalog: dict[str, Any] | Path) -> CatalogIndex:
    if isinstance(catalog, Path):
        catalog = json.loads(catalog.read_text(encoding="utf-8"))
    idx = CatalogIndex()
    details = catalog.get("details") or {}
    for row in catalog.get("index") or []:
        slug = (row.get("slug") or "").strip().lower()
        if not slug:
            continue
        idx.by_slug[slug] = row
        idx.aliases[slug] = slug
        name_slug = slugify(row.get("name") or "")
        if name_slug:
            idx.aliases.setdefault(name_slug, slug)
        hs = host_slug(row.get("site"))
        if hs:
            idx.aliases.setdefault(hs, slug)
            parts = hs.split("-")
            if len(parts) >= 2 and parts[-1] in {"com", "org", "net", "io", "co", "ai", "dev", "app"}:
                idx.aliases.setdefault("-".join(parts[:-1]), slug)
        # details bySource for like-with-like amount diffs
        detail = details.get(slug) or {}
        by = detail.get("bySource") or {}
        idx.by_source[slug] = {
            "oc": float(by.get("oc") or 0),
            "osp": float(by.get("osp") or 0),
            "gh": float(by.get("gh") or 0),
            "own": float(by.get("own") or 0),
        }
    # Explicit OSP aliases always win toward catalog when present
    for osp, cat in OSP_SLUG_ALIASES.items():
        if cat in idx.by_slug:
            idx.aliases[osp] = cat
    return idx


# Retention filter from sponsor-apps-base-github.md / collect.py
OC_MIN_COLLECTIVES = 3
OC_MIN_USD = 5_000.0


def passes_retention(company: dict) -> bool:
    """Keep companies the catalog build would keep."""
    sources = set(company.get("sources") or [])
    if company.get("source"):
        sources.add(company["source"])
    if sources & {"gh", "osp", "own"}:
        return True
    collectives = company.get("collectives") or []
    usd = company.get("publicUsdBySource", {}).get("oc")
    if usd is None:
        # fall back only for pure-OC rows that stored publicUsd as OC total
        if sources <= {"oc"} and company.get("publicUsd") is not None:
            usd = company["publicUsd"]
        else:
            usd = 0.0
    try:
        usd_f = float(usd or 0)
    except (TypeError, ValueError):
        usd_f = 0.0
    if len(collectives) >= OC_MIN_COLLECTIVES or usd_f >= OC_MIN_USD:
        return True
    return False
