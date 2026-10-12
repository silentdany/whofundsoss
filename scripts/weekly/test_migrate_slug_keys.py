from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _load():
    spec = importlib.util.spec_from_file_location("migrate_slug_keys", ROOT / "scripts/data/migrate-slug-keys.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class TestMigrateSlugKeys(unittest.TestCase):
    def _run(self, content: bytes) -> bytes:
        mod = _load()
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            f = d / "holds.csv"
            f.write_bytes(content)
            weekly = d / "w.json"
            weekly.write_text(json.dumps({"companies": [{"slug": "coinsmania"}]}))
            (d / "src/data").mkdir(parents=True)
            (d / "src/data/slug-renames.json").write_text(json.dumps({"renames": {"oinsmania": "coinsmania"}}))
            (d / "src/data/catalog.json").write_text(json.dumps({"index": [{"slug": "coinsmania"}]}))
            mod.ROOT, mod.FILES = d, [f]
            mod.main([str(weekly), "--write"])
            return f.read_bytes()

    def test_crlf_kept(self):
        out = self._run(b"slug,reason\r\noinsmania,x\r\nother,y\r\n")
        self.assertEqual(out, b"slug,reason\r\ncoinsmania,x\r\nother,y\r\n")

    def test_unicode_names_and_lookalikes_untouched(self):
        src = "slug,name\noinsmania,\u0421oinsmania\n\u00e9-oinsmania,a\noinsmania\u00e9,b\noinsmania-like,c\n(coinsmania.com),d\n"
        out = self._run(src.encode()).decode()
        self.assertEqual(
            out,
            "slug,name\ncoinsmania,\u0421oinsmania\n\u00e9-oinsmania,a\noinsmania\u00e9,b\noinsmania-like,c\n(coinsmania.com),d\n",
        )


class TestRebuildTwiceKeepsPendingDrop(unittest.TestCase):
    def test_reapply_rules_twice_on_file(self):
        import subprocess
        import sys
        from scripts.weekly.test_overrides_drops import _rec
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            base = {"companies": [_rec(50)]}
            from datetime import date
            from scripts.weekly.diff import CoverageReport, DiffResult
            from scripts.weekly.report import build_payload
            diff = DiffResult(baseline_kind="weekly", baseline_path="b.json",
                              beneficiary_changes=[{"slug": "openai", "from": 50, "to": 15}])
            cur = build_payload(run_date=date(2026, 10, 12), source_results=[], companies=[_rec(15)],
                                diff=diff, suspects=[], denylist_version="v", denylist_count=0,
                                exclusions_count=0, excluded_from_report=[], duration_s=0,
                                coverage=CoverageReport())
            (d / "b.json").write_text(json.dumps(base))
            (d / "w.json").write_text(json.dumps(cur))
            for _ in range(2):
                subprocess.run([sys.executable, "-m", "scripts.weekly.reapply_rules", str(d / "w.json"), str(d / "b.json")],
                               cwd=ROOT, check=True, capture_output=True)
            out = json.loads((d / "w.json").read_text())
            rec = out["companies"][0]
            self.assertEqual(rec["ghBeneficiaries"], 50)
            self.assertEqual(rec["pendingDrop"]["to"], 15)
            self.assertEqual(out["diff"]["beneficiary_changes"], [])
            self.assertEqual(len([h for h in out["diff"]["held"] if h["hold_kind"] == "sharp_drop"]), 1)


if __name__ == "__main__":
    unittest.main()
