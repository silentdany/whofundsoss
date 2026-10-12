"""Regenerate confusables_latin.py from Unicode's confusables.txt.

Usage: curl -sSfLO https://www.unicode.org/Public/security/latest/confusables.txt
       python3 -m scripts.weekly.gen_confusables confusables.txt
"""
from __future__ import annotations

import re
import sys
import unicodedata
from pathlib import Path


def build(text: str) -> tuple[str, dict[str, str]]:
    ver = (re.search(r"# Date: (\S+)", text) or [None, "unknown"])[1]
    out: dict[str, str] = {}
    for raw in text.lstrip("\ufeff").splitlines():
        line = raw.split("#")[0].strip()
        if not line:
            continue
        src, tgt, _ = [x.strip() for x in line.split(";")]
        cps = src.split()
        if len(cps) != 1:
            continue
        c = chr(int(cps[0], 16))
        if ord(c) < 128 or unicodedata.category(c).startswith("M"):
            continue
        t = "".join(chr(int(x, 16)) for x in tgt.split())
        if re.fullmatch(r"[A-Za-z0-9]{1,2}", t):
            out[c] = t
    return ver, out


def main(path: str) -> None:
    ver, m = build(Path(path).read_text(encoding="utf-8"))
    lines = [
        f'"""Generated from Unicode UTS #39 confusables.txt (Date: {ver}).',
        "",
        "Single non-ASCII code points whose skeleton is 1-2 ASCII letters/digits.",
        "Regenerate with scripts/weekly/gen_confusables.py. Do not edit by hand.",
        '"""',
        "",
        f'CONFUSABLES_VERSION = "{ver}"',
        "",
        "CONFUSABLES_LATIN: dict[str, str] = {",
        *[f"    {ascii(k)}: {m[k]!r}," for k in sorted(m)],
        "}",
    ]
    (Path(__file__).parent / "confusables_latin.py").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1])
