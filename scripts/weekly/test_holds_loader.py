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

    def _assert_fails(self, text: str, *needles: str) -> str:
        p = self._write(HEADER + text)
        with self.assertRaises(HoldsFileError) as cm:
            load_holds(p)
        msg = str(cm.exception)
        for n in needles:
            self.assertIn(n, msg)
        return msg

    def test_missing_review_on_fails_run(self):
        self._assert_fails("openai,gh,x,CdP,2026-10-12,\n", "line 2", "slug openai", "review_on")

    def test_one_bad_row_fails_even_with_valid_rows(self):
        # QA P1: a valid row must not mask an invalid one (fail closed, not open).
        self._assert_fails(
            "bar,gh,y,CdP,2026-10-12,2026-10-19\nopenai,gh,x,CdP,2026-10-12,19/10/2026\n",
            "line 3", "slug openai", "1 invalid hold row",
        )

    def test_non_iso_review_on_fails_run(self):
        for bad in ("19/10/2026", "2026-10-32", "2026-13-45", "2026-1-9", "soon"):
            with self.subTest(bad=bad):
                self._assert_fails(f"openai,gh,x,CdP,2026-10-12,{bad}\n", "line 2", "slug openai", repr(bad))

    def test_unquoted_comma_fails_run(self):
        self._assert_fails("openai,gh,empty read, single run,CdP,2026-10-12,2026-10-19\n", "line 2", "6 columns", "quote")

    def test_wrong_column_count_lists_every_bad_row(self):
        msg = self._assert_fails(
            "openai,gh,x,CdP,2026-10-12,2026-10-19,extra\nshort,gh\n",
            "2 invalid hold row", "line 2", "line 3",
        )
        self.assertNotIn("Traceback", msg)

    def test_missing_slug_fails_run(self):
        self._assert_fails(",gh,x,CdP,2026-10-12,2026-10-19\n", "line 2", "missing slug")

    def test_all_rows_invalid_fails_run(self):
        self._assert_fails("a,gh,x,CdP,2026-10-12,\nb,gh,x,CdP,2026-10-12,nope\n", "2 invalid hold row")

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


class RunFailsOnBadHoldsTest(unittest.TestCase):
    """run.main stops before any fetch with a one-line fatal message, no traceback."""

    def _run_with(self, text: str):
        import contextlib
        import io
        from unittest import mock

        from scripts.weekly import diff as diff_mod
        from scripts.weekly import run as run_mod

        d = tempfile.mkdtemp()
        p = Path(d) / "weekly-holds.csv"
        p.write_text(text, encoding="utf-8")
        err = io.StringIO()
        fetch = mock.Mock(side_effect=AssertionError("must not fetch"))
        with mock.patch.object(diff_mod, "DEFAULT_HOLDS_CSV", p), \
                mock.patch.object(run_mod, "fetch_github_sponsors", fetch), \
                mock.patch.object(run_mod, "fetch_open_collective", fetch), \
                mock.patch.object(run_mod, "fetch_open_source_pledge", fetch), \
                contextlib.redirect_stderr(err):
            code = run_mod.main(["--date", "2026-10-12"])
        fetch.assert_not_called()
        return code, err.getvalue()

    def test_bad_row_exits_1_with_clear_message(self):
        code, err = self._run_with(HEADER + "openai,gh,x,CdP,2026-10-12,19/10/2026\n")
        self.assertEqual(code, 1)
        self.assertTrue(err.startswith("fatal: holds: "), err)
        self.assertIn("line 2 (slug openai)", err)
        self.assertNotIn("Traceback", err)

    def test_bad_header_exits_1_with_clear_message(self):
        code, err = self._run_with("Slug;source;reason\nopenai;gh;x\n")
        self.assertEqual(code, 1)
        self.assertIn("fatal: holds: ", err)
        self.assertIn("expected", err)
        self.assertNotIn("Traceback", err)


if __name__ == "__main__":
    unittest.main()
