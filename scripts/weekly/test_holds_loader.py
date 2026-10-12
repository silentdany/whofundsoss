"""Unit tests for load_holds (data/holds/weekly-holds.csv loader)."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts.weekly.diff import HoldsFileError, load_holds

HEADER = "slug,source,reason,decided_by,since,review_on\n"


class LoadHoldsTest(unittest.TestCase):
    def _write(self, text: str, encoding: str = "utf-8") -> Path:
        d = tempfile.mkdtemp()
        p = Path(d) / "weekly-holds.csv"
        p.write_text(text, encoding=encoding)
        return p

    def test_missing_file_returns_empty(self):
        self.assertEqual(load_holds(Path(tempfile.mkdtemp()) / "nope.csv"), [])

    def test_bom_is_handled(self):
        p = self._write(HEADER + "openai,gh,x,CdP,2026-10-12,2026-10-19\n", encoding="utf-8-sig")
        holds = load_holds(p)
        self.assertEqual([h["slug"] for h in holds], ["openai"])
        self.assertIn("slug", holds[0])

    def test_wrong_header_raises_clear_error(self):
        p = self._write("slug,reason,review_on\nopenai,x,2026-10-19\n")
        with self.assertRaises(HoldsFileError) as cm:
            load_holds(p)
        self.assertIn("expected", str(cm.exception))
        self.assertIn("review_on", str(cm.exception))

    def test_empty_file_raises(self):
        with self.assertRaises(HoldsFileError):
            load_holds(self._write(""))

    def test_missing_review_on_warns_and_skips(self):
        p = self._write(HEADER + "openai,gh,x,CdP,2026-10-12,\nbar,gh,y,CdP,2026-10-12,2026-10-19\n")
        with self.assertLogs("scripts.weekly.diff", level="WARNING") as cm:
            holds = load_holds(p)
        self.assertEqual([h["slug"] for h in holds], ["bar"])
        self.assertTrue(any("line 2" in m and "openai" in m for m in cm.output), cm.output)

    def test_non_iso_review_on_warns_and_skips(self):
        for bad in ("19/10/2026", "2026-10-32", "2026-1-9", "soon"):
            p = self._write(HEADER + f"openai,gh,x,CdP,2026-10-12,{bad}\n")
            with self.assertLogs("scripts.weekly.diff", level="WARNING") as cm:
                self.assertEqual(load_holds(p), [], bad)
            self.assertTrue(any("openai" in m and "line 2" in m for m in cm.output), cm.output)

    def test_wrong_column_count_warns_and_skips(self):
        p = self._write(HEADER + "openai,gh,x,CdP,2026-10-12,2026-10-19,extra\nshort,gh\n")
        with self.assertLogs("scripts.weekly.diff", level="WARNING") as cm:
            self.assertEqual(load_holds(p), [])
        self.assertEqual(len(cm.output), 2)
        self.assertTrue(any("line 2" in m for m in cm.output))
        self.assertTrue(any("line 3" in m for m in cm.output))

    def test_missing_slug_warns(self):
        p = self._write(HEADER + ",gh,x,CdP,2026-10-12,2026-10-19\n")
        with self.assertLogs("scripts.weekly.diff", level="WARNING") as cm:
            self.assertEqual(load_holds(p), [])
        self.assertTrue(any("missing slug" in m for m in cm.output))

    def test_quoted_reason_with_commas(self):
        p = self._write(HEADER + 'openai,gh,"empty read, single run, keep value",CdP,2026-10-12,2026-10-19\n')
        holds = load_holds(p)
        self.assertEqual(len(holds), 1)
        self.assertEqual(holds[0]["reason"], "empty read, single run, keep value")
        self.assertEqual(holds[0]["review_on"], "2026-10-19")

    def test_blank_lines_ignored_silently(self):
        p = self._write(HEADER + "\n,,,,,\nopenai,gh,x,CdP,2026-10-12,2026-10-19\n")
        self.assertEqual([h["slug"] for h in load_holds(p)], ["openai"])

    def test_live_file_loads(self):
        self.assertIn("openai", {h["slug"] for h in load_holds()})


if __name__ == "__main__":
    unittest.main()
