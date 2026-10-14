"""Off-cycle guard: date/flag logic (no network, no data files)."""
from __future__ import annotations

import io
import unittest
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime, timezone

from scripts.weekly.off_cycle import EXIT_REFUSED, OffCycleRefused, decide, is_cycle_day, main, parse_flag


def utc(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)


class TestCycleDay(unittest.TestCase):
    def test_monday_paris(self):
        self.assertTrue(is_cycle_day(utc("2026-10-12T04:17:00")))  # Mon 06:17 Paris

    def test_sunday_utc_but_monday_paris(self):
        # 22:30 UTC Sunday = 00:30 Monday Paris (summer, UTC+2)
        self.assertTrue(is_cycle_day(utc("2026-10-11T22:30:00")))

    def test_monday_utc_but_tuesday_paris(self):
        self.assertFalse(is_cycle_day(utc("2026-10-12T22:30:00")))

    def test_winter_offset(self):
        # 23:30 UTC Sunday 2026-11-01 = 00:30 Monday Paris (UTC+1)
        self.assertTrue(is_cycle_day(utc("2026-11-01T23:30:00")))
        self.assertFalse(is_cycle_day(utc("2026-11-01T22:30:00")))

    def test_naive_rejected(self):
        with self.assertRaises(ValueError):
            is_cycle_day(datetime(2026, 10, 12))


class TestDecide(unittest.TestCase):
    WED = utc("2026-10-14T10:00:00")
    MON = utc("2026-10-12T10:00:00")

    def test_dispatch_midweek_refused_without_flag(self):
        with self.assertRaises(OffCycleRefused):
            decide("workflow_dispatch", self.WED, False)

    def test_dispatch_midweek_allowed_with_flag_is_off_cycle(self):
        self.assertTrue(decide("workflow_dispatch", self.WED, True))

    def test_dispatch_monday_is_on_cycle(self):
        self.assertFalse(decide("workflow_dispatch", self.MON, False))
        self.assertFalse(decide("workflow_dispatch", self.MON, True))

    def test_schedule_monday_on_cycle(self):
        self.assertFalse(decide("schedule", self.MON, False))

    def test_late_schedule_not_refused_but_off_cycle(self):
        self.assertTrue(decide("schedule", self.WED, False))


class TestFlag(unittest.TestCase):
    def test_values(self):
        for v in ("", None, "false", "FALSE", "0", "no"):
            self.assertFalse(parse_flag(v))
        for v in ("true", "True", "1", "yes"):
            self.assertTrue(parse_flag(v))
        with self.assertRaises(ValueError):
            parse_flag("maybe")


class TestCli(unittest.TestCase):
    def _run(self, *argv):
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            rc = main(list(argv))
        return rc, out.getvalue().strip(), err.getvalue()

    def test_refused_exit_code(self):
        rc, out, err = self._run("--event", "workflow_dispatch", "--now", "2026-10-14T10:00:00+00:00")
        self.assertEqual(rc, EXIT_REFUSED)
        self.assertEqual(out, "")
        self.assertIn("allow_off_cycle=true", err)

    def test_allowed_prints_true(self):
        rc, out, _ = self._run("--event", "workflow_dispatch", "--allow", "true", "--now", "2026-10-14T10:00:00+00:00")
        self.assertEqual((rc, out), (0, "off_cycle=true"))

    def test_monday_prints_false(self):
        rc, out, _ = self._run("--event", "schedule", "--now", "2026-10-12T04:17:00+00:00")
        self.assertEqual((rc, out), (0, "off_cycle=false"))

    def test_bad_flag(self):
        rc, _, _ = self._run("--event", "workflow_dispatch", "--allow", "maybe")
        self.assertEqual(rc, 2)


if __name__ == "__main__":
    unittest.main()
