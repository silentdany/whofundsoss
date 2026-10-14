"""Off-cycle guard: date/flag logic (no network, no data files)."""
from __future__ import annotations

import io
import unittest
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime, timezone

from scripts.weekly.off_cycle import EXIT_REFUSED, OffCycleRefused, decide, is_cycle_day, main, parse_flag, run_date_paris


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


class TestParisRunDate(unittest.TestCase):
    def test_sunday_utc_evening_is_monday_paris(self):
        # Sécu B2: 2026-10-18 22:30 UTC = Monday 2026-10-19 00:30 Paris
        now = utc("2026-10-18T22:30:00")
        self.assertEqual(run_date_paris(now), "2026-10-19")
        self.assertFalse(decide("workflow_dispatch", now, False))  # on-cycle, dated Monday

    def test_dst_spring_forward(self):
        # 2026-03-29: clocks go UTC+1 -> UTC+2 at 01:00 UTC.
        self.assertEqual(run_date_paris(utc("2026-03-28T23:30:00")), "2026-03-29")  # Sun 00:30 CET
        self.assertEqual(run_date_paris(utc("2026-03-29T22:30:00")), "2026-03-30")  # Mon 00:30 CEST
        self.assertTrue(is_cycle_day(utc("2026-03-29T22:30:00")))
        self.assertFalse(is_cycle_day(utc("2026-03-29T21:30:00")))  # Sun 23:30 CEST

    def test_cron_and_dispatch_same_paris_monday_share_the_date(self):
        # dispatch Mon 00:30 Paris and cron 04:17 UTC the same Monday -> same date (dedupe catches it)
        self.assertEqual(run_date_paris(utc("2026-10-18T22:30:00")), run_date_paris(utc("2026-10-19T04:17:00")))


class TestEvents(unittest.TestCase):
    def test_only_allowlisted_events(self):
        mon = utc("2026-10-12T10:00:00")
        for ev in ("push", "pull_request", "repository_dispatch", "workflow_call", ""):
            with self.assertRaises(OffCycleRefused):
                decide(ev, mon, True)


class TestFlag(unittest.TestCase):
    def test_values(self):
        for v in ("", None, "false"):
            self.assertFalse(parse_flag(v))
        self.assertTrue(parse_flag("true"))
        for v in ("maybe", "yes", "1", "0", "no", "True", "FALSE"):
            with self.assertRaises(ValueError):
                parse_flag(v)


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
        self.assertEqual((rc, out), (0, "off_cycle=true\ndate=2026-10-14"))

    def test_monday_prints_false(self):
        rc, out, _ = self._run("--event", "schedule", "--now", "2026-10-12T04:17:00+00:00")
        self.assertEqual((rc, out), (0, "off_cycle=false\ndate=2026-10-12"))

    def test_disallowed_event_exit_code(self):
        rc, _, _ = self._run("--event", "push", "--now", "2026-10-12T04:17:00+00:00")
        self.assertEqual(rc, EXIT_REFUSED)

    def test_yes_rejected(self):
        rc, _, _ = self._run("--event", "workflow_dispatch", "--allow", "yes", "--now", "2026-10-14T10:00:00+00:00")
        self.assertEqual(rc, 2)

    def test_bad_flag(self):
        rc, _, _ = self._run("--event", "workflow_dispatch", "--allow", "maybe")
        self.assertEqual(rc, 2)


if __name__ == "__main__":
    unittest.main()


class TestOffCycleMarker(unittest.TestCase):
    def test_values(self):
        from scripts.weekly.off_cycle import is_off_cycle

        self.assertTrue(is_off_cycle(True))
        self.assertTrue(is_off_cycle("true"))
        for v in (False, "false", "TRUE", 1, "1", None, {}, "yes"):
            self.assertFalse(is_off_cycle(v), v)

    def test_cli_file_check(self):
        import json
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as d:
            for value, rc in ((True, 0), ("true", 0), (False, 1), ("false", 1), (None, 1)):
                p = Path(d) / "w.json"
                p.write_text(json.dumps({"date": "2026-10-14", **({} if value is None else {"offCycle": value})}))
                self.assertEqual(main(["--is-off-cycle-file", str(p)]), rc, value)
            with redirect_stderr(io.StringIO()):
                self.assertEqual(main(["--is-off-cycle-file", str(Path(d) / "missing.json")]), 2)


class TestOpenDataPrRequiresDate(unittest.TestCase):
    def test_missing_date_fails_before_any_git(self):
        import os
        import subprocess
        from pathlib import Path

        script = Path(__file__).resolve().parent / "open_data_pr.sh"
        env = {k: v for k, v in os.environ.items() if k != "DATE"}
        env["WFO_WEEKLY_PAT"] = "dummy-not-a-token"
        r = subprocess.run(["bash", str(script)], env=env, capture_output=True, text=True, timeout=30)
        self.assertEqual(r.returncode, 1)
        self.assertIn("DATE is required", r.stderr)

    def test_script_has_no_utc_fallback(self):
        from pathlib import Path

        text = (Path(__file__).resolve().parent / "open_data_pr.sh").read_text()
        self.assertNotIn("date -u", text)
