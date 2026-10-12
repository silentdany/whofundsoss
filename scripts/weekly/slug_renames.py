"""Old -> new company slugs caused by canonical_text in slugify (2026-10-12).

Accent stripping and homoglyph folding change the name-derived slug of a few
companies (et-reo -> etereo, b-rkert-... -> burkert-...). The site keeps 308
redirects for these in src/data/slug-renames.json, so a catalog rebuild that
moves a company to its new key never 404s the old URL.

Regenerate: python3 -m scripts.weekly.slug_renames --write
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from .normalize import legacy_slugify, slugify

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src" / "data" / "slug-renames.json"
SOURCES = [ROOT / "src" / "data" / "catalog.json", *sorted((ROOT / "data" / "weekly").glob("????-??-??.json"))]


def _names(path: Path) -> list[str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    rows = data.get("index") or data.get("companies") or []
    return [r.get("name") or "" for r in rows]


def compute() -> dict[str, str]:
    out: dict[str, str] = {}
    for path in SOURCES:
        if not path.exists():
            continue
        for name in _names(path):
            old, new = legacy_slugify(name), slugify(name)
            if old and new and old != new:
                out[old] = new
    return dict(sorted(out.items()))


def main(argv: list[str]) -> int:
    payload = {
        "note": "Old -> new company slugs from canonical_text (accents, homoglyphs). Served as 308 redirects.",
        "renames": compute(),
    }
    text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    if "--write" in argv:
        OUT.write_text(text, encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
