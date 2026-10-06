"""GitHub Sponsors via GraphQL (gh api graphql or HTTPS).

Public `organization.sponsoring` / `user.sponsoring` lists. Amounts are almost
never public — we never invent monthly figures. Default GITHUB_TOKEN can read
public sponsoring graphs; private sponsorships stay invisible.
"""
from __future__ import annotations

import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .base import SourceResult

REPO_ROOT = Path(__file__).resolve().parents[3]

# Ported / trimmed seed from recherche/github_sponsors/collect.py — orgs we
# always re-check weekly even if they are missing from the published catalog.
SEED_LOGINS = [
    "vercel", "getsentry", "supabase", "stripe", "Shopify", "microsoft",
    "cloudflare", "netlify", "github", "stackblitz", "get-convex", "railway",
    "PostHog", "coderabbitai", "n8n-io", "muxinc", "FrontendMasters",
    "sanity-io", "astral-sh", "typesense", "roboflow", "syntaxfm",
    "GitbookIO", "httptoolkit", "Automattic", "laravel", "anysphere",
]


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _token() -> str | None:
    # Prefer explicit secrets; never log the value.
    for key in ("GH_SPONSORS_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"):
        val = os.environ.get(key)
        if val:
            return val
    return None


def _graphql(query: str, token: str | None) -> dict[str, Any]:
    """Run a GraphQL query via gh CLI (preferred) or HTTPS."""
    if token is None:
        # Try bare `gh` (uses local auth); still never print token.
        cmd = ["gh", "api", "graphql", "-f", f"query={query}"]
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if r.returncode != 0:
                return {"errors": (r.stderr or r.stdout or "gh graphql failed")[:500], "data": None}
            return json.loads(r.stdout)
        except Exception as e:
            return {"errors": str(e), "data": None}

    body = json.dumps({"query": query}).encode()
    req = urllib.request.Request(
        "https://api.github.com/graphql",
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "whofundsoss-weekly-scraper/0.1",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode(errors="replace")[:500]
        return {"errors": f"HTTP {e.code}: {err_body}", "data": None}
    except Exception as e:
        return {"errors": str(e), "data": None}


def _sponsoring_query(login: str, root: str, after: str | None) -> str:
    after_clause = f', after: "{after}"' if after else ""
    return f"""
    query {{
      {root}(login: "{login}") {{
        name
        websiteUrl
        sponsoring(first: 100{after_clause}) {{
          totalCount
          pageInfo {{ hasNextPage endCursor }}
          nodes {{
            __typename
            ... on User {{ login name }}
            ... on Organization {{ login name }}
          }}
        }}
      }}
    }}
    """


def fetch_sponsoring(login: str, token: str | None, *, max_pages: int = 5) -> dict[str, Any] | None:
    """Return {login, name, site, beneficiaries:[{login,name,type}], totalCount} or None if missing."""
    for root in ("organization", "user"):
        nodes: list[dict] = []
        cursor = None
        total = None
        name = None
        site = None
        found = False
        for _ in range(max_pages):
            data = _graphql(_sponsoring_query(login, root, cursor), token)
            if data.get("errors") and not data.get("data"):
                # hard fail — bubble up by returning a sentinel with error
                return {"_error": str(data.get("errors"))}
            ent = (data.get("data") or {}).get(root)
            if not ent:
                break
            found = True
            name = ent.get("name") or name
            site = ent.get("websiteUrl") or site
            sp = ent.get("sponsoring") or {}
            total = sp.get("totalCount")
            for n in sp.get("nodes") or []:
                if not n or not n.get("login"):
                    continue
                nodes.append({
                    "login": n["login"],
                    "name": n.get("name"),
                    "type": "org" if n.get("__typename") == "Organization" else "user",
                })
            pi = sp.get("pageInfo") or {}
            if pi.get("hasNextPage") and pi.get("endCursor"):
                cursor = pi["endCursor"]
                time.sleep(0.15)
            else:
                break
        if found:
            return {
                "login": login,
                "slug": login.lower(),
                "name": name or login,
                "site": site,
                "source": "gh",
                "beneficiaries": nodes,
                "ghBeneficiaries": total if total is not None else len(nodes),
                "publicUsd": None,  # never invent GH amounts
            }
    return None


def seed_logins_from_catalog(catalog_path: Path | None = None) -> list[str]:
    path = catalog_path or (REPO_ROOT / "src" / "data" / "catalog.json")
    logins = list(SEED_LOGINS)
    if not path.exists():
        return sorted(set(logins), key=str.lower)
    try:
        catalog = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return sorted(set(logins), key=str.lower)
    for row in catalog.get("index") or []:
        sources = row.get("sources") or []
        if "gh" in sources and row.get("slug"):
            logins.append(row["slug"])
    # Cap weekly GH surface to keep rate limits sane
    uniq: list[str] = []
    seen: set[str] = set()
    for login in logins:
        key = login.lower()
        if key in seen:
            continue
        seen.add(key)
        uniq.append(login)
        if len(uniq) >= 120:
            break
    return uniq


def fetch_github_sponsors(
    *,
    logins: list[str] | None = None,
    catalog_path: Path | None = None,
    token: str | None = None,
) -> SourceResult:
    fetched_at = _now()
    token = token if token is not None else _token()
    targets = logins if logins is not None else seed_logins_from_catalog(catalog_path)
    items: list[dict] = []
    errors: list[str] = []
    for login in targets:
        try:
            row = fetch_sponsoring(login, token)
        except Exception as e:
            errors.append(f"{login}: {e}")
            continue
        if row is None:
            continue
        if "_error" in row:
            errors.append(f"{login}: {row['_error']}")
            # One hard GraphQL auth/rate failure: mark whole source unavailable
            if "401" in row["_error"] or "Bad credentials" in row["_error"] or "403" in row["_error"]:
                return SourceResult(
                    name="github_sponsors",
                    status="unavailable",
                    error=row["_error"][:400],
                    fetched_at=fetched_at,
                    meta={"attempted": len(targets), "partial_errors": len(errors)},
                )
            continue
        items.append(row)
        time.sleep(0.05)

    if not items and errors:
        return SourceResult(
            name="github_sponsors",
            status="unavailable",
            error="; ".join(errors[:5]),
            fetched_at=fetched_at,
            meta={"attempted": len(targets), "errors": len(errors)},
        )
    return SourceResult(
        name="github_sponsors",
        status="ok",
        items=items,
        fetched_at=fetched_at,
        meta={
            "attempted": len(targets),
            "ok": len(items),
            "soft_errors": len(errors),
            "auth": "token" if token else "gh-cli-or-none",
        },
    )
