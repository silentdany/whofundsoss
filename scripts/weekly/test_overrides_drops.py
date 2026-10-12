from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.weekly.diff import (
    CoverageReport,
    apply_drop_confirmation,
    apply_holds,
    apply_site_overrides,
    diff_snapshots,
    load_holds,
    load_site_overrides,
)

COV = CoverageReport(sources={"github_sponsors": {"full": True, "status": "ok", "meta": {}}})


def _bens(n):
    return [{"login": f"u{i}"} for i in range(n)]


def _rec(n, **extra):
    return {"slug": "openai", "name": "OpenAI", "login": "openai", "sources": ["gh"],
            "ghBeneficiaries": n, "beneficiaries": _bens(n), **extra}


class TestSiteOverrides(unittest.TestCase):
    def test_repo_file_pins_voidzero(self):
        ov = load_site_overrides()
        self.assertEqual(ov["voidzero-dev"], "https://voidzero.dev")
        out = apply_site_overrides(
            [{"slug": "voidzero-dev", "site": "https://fosstodon.org/@opensourcepledge"},
             {"slug": "other", "site": "https://other.dev"}], ov)
        self.assertEqual(out[0]["site"], "https://voidzero.dev")
        self.assertEqual(out[1]["site"], "https://other.dev")

    def test_missing_file_and_invalid(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(load_site_overrides(Path(d) / "nope.json"), {})
            p = Path(d) / "bad.json"
            p.write_text(json.dumps({"x": "voidzero.dev"}))
            with self.assertRaises(ValueError):
                load_site_overrides(p)

    def test_published_weekly_has_voidzero_site(self):
        p = Path(__file__).resolve().parents[2] / "data" / "weekly" / "2026-10-12.json"
        rec = next(c for c in json.loads(p.read_text())["companies"] if c["slug"] == "voidzero-dev")
        self.assertEqual(rec["site"], "https://voidzero.dev")


class TestSharpDropRule(unittest.TestCase):
    def _run(self, base, cur, date="2026-10-12"):
        diff = diff_snapshots(cur, base, baseline_kind="weekly", baseline_path="w1.json", coverage=COV)
        out = apply_drop_confirmation(diff, cur, base, run_date=date)
        return diff, out

    def test_first_sharp_drop_keeps_previous(self):
        diff, out = self._run([_rec(50)], [_rec(15)])
        self.assertEqual(out[0]["ghBeneficiaries"], 50)
        self.assertEqual(len(out[0]["beneficiaries"]), 50)
        self.assertEqual(out[0]["pendingDrop"]["to"], 15)
        self.assertEqual(diff.beneficiary_changes, [])
        self.assertEqual(diff.held[0]["hold_kind"], "sharp_drop")

    def test_second_consecutive_sharp_drop_publishes(self):
        base = [_rec(50, pendingDrop={"from": 50, "to": 15, "readings": 1})]
        diff, out = self._run(base, [_rec(14)], "2026-10-19")
        self.assertEqual(out[0]["ghBeneficiaries"], 14)
        self.assertNotIn("pendingDrop", out[0])
        self.assertEqual(diff.beneficiary_changes[0]["to"], 14)

    def test_recovery_clears_pending(self):
        base = [_rec(50, pendingDrop={"from": 50, "to": 15, "readings": 1})]
        _, out = self._run(base, [_rec(48)], "2026-10-19")
        self.assertEqual(out[0]["ghBeneficiaries"], 48)
        self.assertNotIn("pendingDrop", out[0])

    def test_drop_of_exactly_half_or_less_publishes(self):
        _, out = self._run([_rec(50)], [_rec(25)])
        self.assertEqual(out[0]["ghBeneficiaries"], 25)
        self.assertNotIn("pendingDrop", out[0])

    def test_zero_left_to_two_zero_rule(self):
        base = [_rec(50)]
        diff, out = self._run(base, [])
        out = apply_holds(diff, out, base, [], run_date="2026-10-12")
        self.assertEqual(out[0]["hold"]["kind"], "zero_reading")


class TestOpenaiHoldIntact(unittest.TestCase):
    def test_manual_hold_row_kept(self):
        h = next(x for x in load_holds() if x["slug"] == "openai")
        self.assertEqual(h["review_on"], "2026-10-19")

    def test_published_weekly_keeps_50(self):
        p = Path(__file__).resolve().parents[2] / "data" / "weekly" / "2026-10-12.json"
        d = json.loads(p.read_text())
        rec = next(c for c in d["companies"] if c["slug"] == "openai")
        self.assertEqual(rec["ghBeneficiaries"], 50)
        self.assertEqual(len(rec["beneficiaries"]), 50)
        self.assertFalse([r for r in d["diff"]["beneficiary_changes"] if r["slug"] == "openai"])


if __name__ == "__main__":
    unittest.main()


class TestPendingDropPersists(unittest.TestCase):
    def test_write_reload_then_second_reading_publishes(self):
        from datetime import date
        from scripts.weekly.diff import DiffResult
        from scripts.weekly.report import build_payload

        week0 = [_rec(50)]
        diff, comps = TestSharpDropRule()._run(week0, [_rec(15)])
        payload = build_payload(run_date=date(2026, 10, 12), source_results=[], companies=comps,
                                diff=diff, suspects=[], denylist_version="v", denylist_count=0,
                                exclusions_count=0, excluded_from_report=[], duration_s=0,
                                coverage=COV)
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "2026-10-12.json"
            p.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            reloaded = json.loads(p.read_text(encoding="utf-8"))["companies"]
        self.assertEqual(reloaded[0]["ghBeneficiaries"], 50)
        self.assertEqual(reloaded[0]["pendingDrop"]["to"], 15)
        diff2 = diff_snapshots([_rec(14)], reloaded, baseline_kind="weekly", baseline_path=str(p), coverage=COV)
        out = apply_drop_confirmation(diff2, [_rec(14)], reloaded, run_date="2026-10-19")
        self.assertEqual(out[0]["ghBeneficiaries"], 14)
        self.assertNotIn("pendingDrop", out[0])
