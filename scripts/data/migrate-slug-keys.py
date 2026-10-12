#!/usr/bin/env python3
"""Migrate denylist / hold / exclusion keys along slug-renames.json for a data rebuild.

Run in the SAME commit as the rebuilt data. For each old -> new rename, a key is
rewritten to the new form only when the rebuilt data (catalog + the given weekly
file) uses the new slug and no longer the old one. Lookups already accept both
forms (slug_aliases), so this keeps written keys equal to the published slugs.

  python3 scripts/data/migrate-slug-keys.py data/weekly/2026-10-12.json [--write]
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FILES = [
    ROOT / "src/lib/spam-denylist.ts",
    ROOT / "src/data/public-spam-denylist.json",
    ROOT / "public/denylist.json",
    ROOT / "public/denylist.md",
    *sorted((ROOT / "data/holds").glob("*.csv")),
    *sorted((ROOT / "data/exclusions").glob("*.csv")),
]


def used_slugs(weekly: Path) -> set[str]:
    cat = json.loads((ROOT / "src/data/catalog.json").read_text(encoding="utf-8"))
    w = json.loads(weekly.read_text(encoding="utf-8"))
    out = {r["slug"] for r in cat.get("index", [])}
    out |= {r["slug"] for r in w.get("companies", [])}
    out |= {r["slug"] for r in w.get("excludedNoted", [])}
    return out


def main(argv: list[str]) -> int:
    weekly = Path(argv[0])
    write = "--write" in argv
    renames = json.loads((ROOT / "src/data/slug-renames.json").read_text(encoding="utf-8"))["renames"]
    used = used_slugs(weekly)
    todo = {o: n for o, n in renames.items() if n in used and o not in used}
    changed = 0
    for f in FILES:
        if not f.exists():
            continue
        text = f.read_text(encoding="utf-8")
        new = text
        for o, n in todo.items():
            new = re.sub(rf"(?<![a-z0-9-]){re.escape(o)}(?![a-z0-9-])", n, new)
        if new != text:
            changed += 1
            print(f"migrate {f.relative_to(ROOT)}")
            if write:
                f.write_text(new, encoding="utf-8")
    print(f"renames applicable: {todo or 'none'}; files changed: {changed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
