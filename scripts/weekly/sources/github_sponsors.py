"""GitHub Sponsors via GraphQL (gh api graphql or HTTPS).

Public `organization.sponsoring` / `user.sponsoring` lists. Amounts are almost
never public — we never invent monthly figures. Default GITHUB_TOKEN can read
public sponsoring graphs; private sponsorships stay invisible.

Logins are allowlisted before any GraphQL call. Queries use variables — never
string-concatenate untrusted login text into the query document.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .base import SourceResult

REPO_ROOT = Path(__file__).resolve().parents[3]

# GitHub login rule: 1–39 chars, alphanumeric or hyphen; no leading/trailing hyphen.
LOGIN_RE = re.compile(r"^[A-Za-z0-9-]{1,39}$")

# Ported / trimmed seed from recherche/github_sponsors/collect.py — orgs we
# always re-check weekly even if they are missing from the published catalog.
SEED_LOGINS = [
    "vercel", "getsentry", "supabase", "stripe", "Shopify", "microsoft",
    "cloudflare", "netlify", "github", "stackblitz", "get-convex", "railway",
    "PostHog", "coderabbitai", "n8n-io", "muxinc", "FrontendMasters",
    "sanity-io", "astral-sh", "typesense", "roboflow", "syntaxfm",
    "GitbookIO", "httptoolkit", "Automattic", "laravel", "anysphere",
]

SPONSORING_QUERY = """
query($login: String!, $after: String) {
  repositoryOwner(login: $login) {
    ... on Organization {
      name
      websiteUrl
      sponsoring(first: 100, after: $after) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes {
          __typename
          ... on User { login name }
          ... on Organization { login name }
        }
      }
    }
    ... on User {
      name
      websiteUrl
      sponsoring(first: 100, after: $after) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes {
          __typename
          ... on User { login name }
          ... on Organization { login name }
        }
      }
    }
  }
}
"""


def sanitize_login(login: str) -> str | None:
    """Return login if it matches GitHub's login rules, else None.

    Invalid values are never passed to GraphQL. Callers should log the skip
    without re-injecting the raw string into a query.
    """
    if login is None:
        return None
    candidate = str(login).strip()
    if not candidate or not LOGIN_RE.fullmatch(candidate):
        return None
    # Reject leading/trailing hyphen explicitly (also covered by LOGIN_RE).
    if candidate.startswith("-") or candidate.endswith("-"):
        return None
    return candidate


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _token() -> str | None:
    # Prefer explicit secrets; never log the value.
    for key in ("GH_SPONSORS_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"):
        val = os.environ.get(key)
        if val:
            return val
    return None


def _graphql(query: str, variables: dict[str, Any] | None, token: str | None) -> dict[str, Any]:
    """Run a GraphQL query with variables (never interpolate untrusted values)."""
    variables = variables or {}
    if token is None:
        cmd = ["gh", "api", "graphql", "-f", f"query={query}"]
        for k, v in variables.items():
            if v is None:
                continue
            if isinstance(v, bool):
                cmd += ["-F", f"{k}={'true' if v else 'false'}"]
            elif isinstance(v, int):
                cmd += ["-F", f"{k}={v}"]
            else:
                cmd += ["-f", f"{k}={v}"]
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if r.returncode != 0:
                return {"errors": (r.stderr or r.stdout or "gh graphql failed")[:500], "data": None}
            return json.loads(r.stdout)
        except Exception as e:
            return {"errors": str(e), "data": None}

    body = json.dumps({"query": query, "variables": variables}).encode()
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


def fetch_sponsoring(login: str, token: str | None, *, max_pages: int = 5) -> dict[str, Any] | None:
    """Return {login, name, site, beneficiaries, totalCount} or None if missing.

    `login` must already be sanitize_login()-ed by the caller.
    """
    safe = sanitize_login(login)
    if safe is None:
        return {"_error": "invalid_login_rejected"}

    nodes: list[dict] = []
    cursor = None
    total = None
    name = None
    site = None
    found = False

    for _ in range(max_pages):
        data = _graphql(
            SPONSORING_QUERY,
            {"login": safe, "after": cursor},
            token,
        )
        if data.get("errors") and not data.get("data"):
            return {"_error": str(data.get("errors"))}
        owner = (data.get("data") or {}).get("repositoryOwner")
        if not owner:
            break
        found = True
        name = owner.get("name") or name
        site = owner.get("websiteUrl") or site
        sp = owner.get("sponsoring") or {}
        total = sp.get("totalCount")
        for n in sp.get("nodes") or []:
            if not n or not n.get("login"):
                continue
            # Beneficiaries are GitHub logins from the API — still sanitize.
            blogin = sanitize_login(n["login"])
            if blogin is None:
                continue
            nodes.append({
                "login": blogin,
                "name": n.get("name"),
                "type": "org" if n.get("__typename") == "Organization" else "user",
            })
        pi = sp.get("pageInfo") or {}
        if pi.get("hasNextPage") and pi.get("endCursor"):
            cursor = pi["endCursor"]
            time.sleep(0.15)
        else:
            break

    if not found:
        return None
    return {
        "login": safe,
        "slug": safe.lower(),
        "name": name or safe,
        "site": site,
        "source": "gh",
        "beneficiaries": nodes,
        "ghBeneficiaries": total if total is not None else len(nodes),
        "publicUsd": None,  # never invent GH amounts
    }


def seed_logins_from_catalog(catalog_path: Path | None = None) -> list[str]:
    """Full catalog GH surface (same scope as the published catalog's gh companies)."""
    path = catalog_path or (REPO_ROOT / "src" / "data" / "catalog.json")
    logins = list(SEED_LOGINS)
    if path.exists():
        try:
            catalog = json.loads(path.read_text(encoding="utf-8"))
            for row in catalog.get("index") or []:
                if "gh" in (row.get("sources") or []) and row.get("slug"):
                    logins.append(row["slug"])
        except Exception:
            pass
    uniq: list[str] = []
    seen: set[str] = set()
    for login in logins:
        safe = sanitize_login(login)
        if safe is None:
            continue
        key = safe.lower()
        if key in seen:
            continue
        seen.add(key)
        uniq.append(safe)
    return uniq


def fetch_github_sponsors(
    *,
    logins: list[str] | None = None,
    catalog_path: Path | None = None,
    token: str | None = None,
) -> SourceResult:
    fetched_at = _now()
    token = token if token is not None else _token()
    raw_targets = logins if logins is not None else seed_logins_from_catalog(catalog_path)

    targets: list[str] = []
    skipped: list[str] = []
    for raw in raw_targets:
        safe = sanitize_login(raw)
        if safe is None:
            # Log a redacted hint only (length + whether it had odd chars) — do not
            # re-inject the raw string into further processing.
            skipped.append(f"<invalid len={len(str(raw))}>")
            continue
        targets.append(safe)

    if skipped:
        print(f"github_sponsors: skipped {len(skipped)} invalid login(s): {', '.join(skipped[:10])}", flush=True)

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
            if "401" in row["_error"] or "Bad credentials" in row["_error"] or "403" in row["_error"]:
                return SourceResult(
                    name="github_sponsors",
                    status="unavailable",
                    error=row["_error"][:400],
                    fetched_at=fetched_at,
                    meta={"attempted": len(targets), "partial_errors": len(errors), "skipped_invalid": len(skipped)},
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
            meta={"attempted": len(targets), "errors": len(errors), "skipped_invalid": len(skipped)},
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
            "skipped_invalid": len(skipped),
            "auth": "token" if token else "gh-cli-or-none",
            "capped": False,
        },
    )
