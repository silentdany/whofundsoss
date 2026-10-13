#!/usr/bin/env python3
"""Regenerate the public denylist copies from src/lib/spam-denylist.ts.

Writes src/data/public-spam-denylist.json, public/denylist.json and
public/denylist.md. Entries, counts and version come from the .ts source;
title, summary, criteria and "reviewed and not listed" are kept from the
existing JSON. Never edit the public copies by hand.

  python3 scripts/data/export-denylist.py [--check]
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from scripts.weekly.denylist import parse_spam_denylist  # noqa: E402

TS = ROOT / "src/lib/spam-denylist.ts"
OUT_JSON = [ROOT / "src/data/public-spam-denylist.json", ROOT / "public/denylist.json"]
OUT_MD = ROOT / "public/denylist.md"


def build() -> tuple[str, str]:
    version, entries = parse_spam_denylist(TS)
    m = re.search(r"as of (\d{4}-\d{2}-\d{2})", TS.read_text(encoding="utf-8"))
    prev = json.loads(OUT_JSON[0].read_text(encoding="utf-8"))
    rows = sorted(entries.values(), key=lambda e: (e.category, e.slug))
    by_cat: dict[str, int] = {}
    for e in rows:
        by_cat[e.category] = by_cat.get(e.category, 0) + 1
    data = {
        "title": prev["title"],
        "version": version,
        "as_of": m.group(1) if m else prev["as_of"],
        "summary": prev["summary"],
        "counts": {"total": len(rows), "by_category": dict(sorted(by_cat.items()))},
        "criteria": prev["criteria"],
        "entries": [{"slug": e.slug, "category": e.category, "reason": e.reason} for e in rows],
        "reviewed_and_not_listed": prev["reviewed_and_not_listed"],
    }
    js = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    md = [
        "# Spam denylist", "",
        f"**Version** {version} · as of {data['as_of']} · **{len(rows)}** entries", "",
        data["summary"], "",
        "## Counts by category", "",
        "| Category | Count |", "|---|---:|",
        *[f"| {c} | {n} |" for c, n in data["counts"]["by_category"].items()],
        f"| **Total** | **{len(rows)}** |", "",
        "## Criteria", "",
        *[f"- **{c}** — {t}" for c, t in data["criteria"].items()], "",
        "## Entries (already documented as excluded)", "",
        "| Slug | Category | Reason |", "|---|---|---|",
        *[f"| `{e.slug}` | {e.category} | {e.reason} |" for e in rows], "",
        "## Reviewed and not listed", "",
        "These were reviewed and left out of the denylist because they are not clearly spam:", "",
    ]
    for r in data["reviewed_and_not_listed"]:
        sep = ": " if r["slug"] == "sxl-cn" else " — "
        md.append(f"- `{r['slug']}`{sep}{r['note']}")
    return js, "\n".join(md) + "\n\n"


def main(argv: list[str]) -> int:
    js, md = build()
    targets = [(p, js) for p in OUT_JSON] + [(OUT_MD, md)]
    stale = [p for p, t in targets if not p.exists() or p.read_text(encoding="utf-8") != t]
    if "--check" in argv:
        for p in stale:
            print(f"stale: {p.relative_to(ROOT)}", file=sys.stderr)
        return 1 if stale else 0
    for p, t in targets:
        p.write_text(t, encoding="utf-8")
    print(f"wrote {len(targets)} files ({len(stale)} changed)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
