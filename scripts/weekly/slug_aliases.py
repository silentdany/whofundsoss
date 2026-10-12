"""Old <-> new slug equivalence from src/data/slug-renames.json.

Denylist, exclusion and hold keys stay as written (old form). Every lookup goes
through slug_equivalents(), so a key matches the company before and after a
catalog rebuild moves it to its canonical slug.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

RENAMES_PATH = Path(__file__).resolve().parents[2] / "src" / "data" / "slug-renames.json"


@lru_cache(maxsize=1)
def _maps() -> tuple[dict[str, str], dict[str, str]]:
    renames = json.loads(RENAMES_PATH.read_text(encoding="utf-8"))["renames"]
    fwd = {k.lower(): v.lower() for k, v in renames.items()}
    return fwd, {v: k for k, v in fwd.items()}


def slug_equivalents(slug: str) -> list[str]:
    s = (slug or "").strip().lower()
    if not s:
        return []
    fwd, back = _maps()
    out = [s]
    for other in (fwd.get(s), back.get(s)):
        if other and other not in out:
            out.append(other)
    return out
