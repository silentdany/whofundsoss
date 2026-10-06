"""Catalog-aligned slug normalization and identity resolution.

Catalog rule (from the publishable → build-catalog pipeline):
  slug = login_github.lower()  if login_github else slugify(entreprise_name)

Website matching uses the exact normalized domain only (lowercase, strip www.,
scheme, path, port). Generic hosts (opencollective.com, github.com, …) are
never registered as aliases — see generic_hosts.py.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from .generic_hosts import is_generic_host

# Known OSP member slug → catalog slug (when GH login differs from OSP path).

# Catalog slug merges (dropped → kept). Applied in resolve() like OSP aliases.
CATALOG_SLUG_ALIASES: dict[str, str] = {
    "nx-by-nrwl": "nrwl",
}

OSP_SLUG_ALIASES: dict[str, str] = {
    # Catalog merge 2026-10-06 (also used as general alias key)

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


def normalize_domain(site: str | None) -> str | None:
    """Exact normalized domain: lowercase, no www., no scheme/path/port.

    Returns None for empty/unparseable/generic hosts.
    """
    if not site:
        return None
    raw = site.strip()
    if not raw:
        return None
    if not raw.startswith("http"):
        raw = "https://" + raw
    try:
        parsed = urlparse(raw)
        host = (parsed.hostname or "").lower()
    except Exception:
        return None
    host = host.removeprefix("www.")
    if not host or is_generic_host(host):
        return None
    return host


def host_slug(site: str | None) -> str:
    """Legacy kebab host slug — only for non-generic hosts."""
    domain = normalize_domain(site)
    if not domain:
        return ""
    return slugify(domain)


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
    by_domain: dict[str, str] = field(default_factory=dict)  # exact domain → catalog slug
    by_source: dict[str, dict[str, float]] = field(default_factory=dict)

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
            login_l = login.strip().lower()
            candidates.append(CATALOG_SLUG_ALIASES.get(login_l, login_l))
            candidates.append(login_l)
        if osp_slug:
            osp = osp_slug.strip().lower()
            candidates.append(OSP_SLUG_ALIASES.get(osp, osp))
            candidates.append(osp)
        if oc_slug:
            candidates.append(oc_slug.strip().lower())
        if name:
            candidates.append(slugify(name))

        for key in candidates:
            if not key:
                continue
            if key in self.aliases:
                return self.aliases[key]
            if key in self.by_slug:
                return key

        # Exact domain match only (no substring, no generic hosts).
        domain = normalize_domain(site)
        if domain and domain in self.by_domain:
            return self.by_domain[domain]

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
        domain = normalize_domain(row.get("site"))
        if domain:
            # Exact domain only — first catalog row wins; never overwrite.
            idx.by_domain.setdefault(domain, slug)
            # Also allow kebab form of the exact domain as alias (ag-grid-com),
            # but NOT stripped TLD variants that collide across brands.
            idx.aliases.setdefault(slugify(domain), slug)
        detail = details.get(slug) or {}
        by = detail.get("bySource") or {}
        idx.by_source[slug] = {
            "oc": float(by.get("oc") or 0),
            "osp": float(by.get("osp") or 0),
            "gh": float(by.get("gh") or 0),
            "own": float(by.get("own") or 0),
        }
    for osp, cat in OSP_SLUG_ALIASES.items():
        if cat in idx.by_slug:
            idx.aliases[osp] = cat
    for dropped, kept in CATALOG_SLUG_ALIASES.items():
        if kept in idx.by_slug:
            idx.aliases[dropped] = kept
    return idx


OC_MIN_COLLECTIVES = 3
OC_MIN_USD = 5_000.0


def passes_retention(company: dict) -> bool:
    """Keep companies the catalog build would keep.

    GH-only rows with zero (or null) beneficiaries are skipped — empty seed
    logins (cloudflare / netlify / anysphere) are not sponsors.
    """
    sources = set(company.get("sources") or [])
    if company.get("source"):
        sources.add(company["source"])

    if sources <= {"gh"} or (sources == {"gh"}):
        bens = company.get("ghBeneficiaries")
        ben_list = company.get("beneficiaries") or []
        try:
            bens_n = int(bens) if bens is not None else 0
        except (TypeError, ValueError):
            bens_n = 0
        if bens_n <= 0 and not ben_list:
            return False

    if sources & {"gh", "osp", "own"}:
        # GH with real beneficiaries (or mixed with other sources) stays.
        if "gh" in sources and not (sources & {"osp", "oc", "own"}):
            bens = company.get("ghBeneficiaries")
            ben_list = company.get("beneficiaries") or []
            try:
                bens_n = int(bens) if bens is not None else 0
            except (TypeError, ValueError):
                bens_n = 0
            if bens_n <= 0 and not ben_list:
                return False
        return True

    collectives = company.get("collectives") or []
    usd = company.get("publicUsdBySource", {}).get("oc")
    if usd is None:
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
