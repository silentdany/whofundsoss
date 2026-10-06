"""Parse the TypeScript spam denylist and the versioned raw-exclusions CSV.

The TypeScript file `src/lib/spam-denylist.ts` is the single source of truth for
SEO-spam company slugs. This module reads it; it never keeps a divergent copy.
`data/exclusions/raw-exclusions.csv` is the 120 publishable-build exclusions
(spam_casino / spam_vpn / spam_followers / spam_seo / supabase_self_fund).
"""
from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DENYLIST_TS = REPO_ROOT / "src" / "lib" / "spam-denylist.ts"
DEFAULT_EXCLUSIONS_CSV = REPO_ROOT / "data" / "exclusions" / "raw-exclusions.csv"

# Matches: "slug-here": { category: "gambling", source: "qa", reason: "..." },
_ENTRY_RE = re.compile(
    r'^\s*"([^"]+)":\s*\{\s*category:\s*"([^"]+)",\s*source:\s*"([^"]+)",\s*reason:\s*"([^"]*)"',
    re.MULTILINE,
)
_VERSION_RE = re.compile(r'export const SPAM_DENYLIST_VERSION\s*=\s*"([^"]+)"')


@dataclass(frozen=True)
class DenylistEntry:
    slug: str
    category: str
    source: str
    reason: str


@dataclass(frozen=True)
class ExclusionEntry:
    entreprise: str
    login_github: str
    site: str
    total_public_connu_usd: float
    nb_beneficiaires_github: int
    exclusion_raison: str
    date_verif: str

    @property
    def slug_guess(self) -> str:
        login = (self.login_github or "").strip().lower()
        if login:
            return login
        # Derive a slug-ish key from site host when login is empty
        site = (self.site or "").strip().lower()
        site = re.sub(r"^https?://", "", site)
        site = site.split("/")[0]
        site = site.removeprefix("www.")
        return site.replace(".", "-") if site else self.entreprise.lower().replace(" ", "-")


def parse_spam_denylist(path: Path | None = None) -> tuple[str, dict[str, DenylistEntry]]:
    """Parse spam-denylist.ts. Raises ValueError if the file is empty or malformed."""
    path = path or DEFAULT_DENYLIST_TS
    text = path.read_text(encoding="utf-8")
    version_m = _VERSION_RE.search(text)
    if not version_m:
        raise ValueError(f"SPAM_DENYLIST_VERSION not found in {path}")
    version = version_m.group(1)
    entries: dict[str, DenylistEntry] = {}
    for m in _ENTRY_RE.finditer(text):
        slug, category, source, reason = m.groups()
        entries[slug] = DenylistEntry(slug=slug, category=category, source=source, reason=reason)
    if not entries:
        raise ValueError(f"No denylist entries parsed from {path}")
    return version, entries


def load_raw_exclusions(path: Path | None = None) -> list[ExclusionEntry]:
    path = path or DEFAULT_EXCLUSIONS_CSV
    rows: list[ExclusionEntry] = []
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for raw in reader:
            try:
                usd = float(raw.get("total_public_connu_usd") or 0)
            except (TypeError, ValueError):
                usd = 0.0
            try:
                gh = int(float(raw.get("nb_beneficiaires_github") or 0))
            except (TypeError, ValueError):
                gh = 0
            rows.append(
                ExclusionEntry(
                    entreprise=(raw.get("entreprise") or "").strip(),
                    login_github=(raw.get("login_github") or "").strip(),
                    site=(raw.get("site") or "").strip(),
                    total_public_connu_usd=usd,
                    nb_beneficiaires_github=gh,
                    exclusion_raison=(raw.get("exclusion_raison") or "").strip(),
                    date_verif=(raw.get("date_verif") or "").strip(),
                )
            )
    if not rows:
        raise ValueError(f"No exclusion rows in {path}")
    return rows


def is_excluded(
    *,
    slug: str,
    name: str = "",
    site: str = "",
    login: str = "",
    denylist: dict[str, DenylistEntry] | None = None,
    exclusions: list[ExclusionEntry] | None = None,
) -> str | None:
    """Return exclusion reason if the company is on the denylist or raw exclusions.

    Never invents a match. Returns None when the company is clean.
    """
    slug_l = (slug or "").strip().lower()
    login_l = (login or slug_l).strip().lower()
    name_l = (name or "").strip().lower()
    site_l = (site or "").strip().lower()

    if denylist is not None and slug_l in denylist:
        e = denylist[slug_l]
        return f"denylist:{e.category}:{e.reason}"

    if exclusions is None:
        return None
    for row in exclusions:
        if login_l and row.login_github and row.login_github.lower() == login_l:
            return f"exclusion:{row.exclusion_raison}"
        if name_l and row.entreprise and row.entreprise.lower() == name_l:
            return f"exclusion:{row.exclusion_raison}"
        if site_l and row.site:
            from .normalize import normalize_domain
            d1 = normalize_domain(site_l)
            d2 = normalize_domain(row.site)
            if d1 and d2 and d1 == d2:
                return f"exclusion:{row.exclusion_raison}"
            # Exact full-URL equality (after strip trailing slash) as fallback
            if site_l.rstrip("/") == row.site.lower().rstrip("/"):
                return f"exclusion:{row.exclusion_raison}"
    return None
