"""Off-cycle runs never count toward the two-readings rules (PR #41)."""
from __future__ import annotations

import unittest

from scripts.weekly.diff import CoverageReport, apply_drop_confirmation, apply_holds, diff_snapshots

COV = CoverageReport(sources={"github_sponsors": {"full": True, "status": "ok", "meta": {"ok_logins": ["n32-tech", "openai"]}}})


def _base(**extra):
    return [{"slug": "n32-tech", "name": "n32.tech", "login": "n32-tech", "sources": ["gh"], "ghBeneficiaries": 1, **extra}]


def _zero(base, date, off_cycle=False):
    diff = diff_snapshots([], base, baseline_kind="weekly", baseline_path="w.json", coverage=COV)
    out = apply_holds(diff, [], base, [], run_date=date, off_cycle=off_cycle)
    return diff, out


def _rec(n, **extra):
    return {"slug": "openai", "name": "OpenAI", "login": "openai", "sources": ["gh"],
            "ghBeneficiaries": n, "beneficiaries": [{"login": f"u{i}"} for i in range(n)], **extra}


def _drop(base, cur, date, off_cycle=False):
    diff = diff_snapshots(cur, base, baseline_kind="weekly", baseline_path="w.json", coverage=COV)
    return diff, apply_drop_confirmation(diff, cur, base, run_date=date, off_cycle=off_cycle)


class TestZeroRuleOffCycle(unittest.TestCase):
    def test_off_cycle_second_zero_does_not_release(self):
        _, w1 = _zero(_base(), "2026-10-12")  # Monday: first zero, held
        diff, w2 = _zero(w1, "2026-10-14", off_cycle=True)  # Wednesday
        self.assertEqual(diff.disappeared_sponsors, [])
        self.assertEqual(w2[0]["hold"]["kind"], "zero_reading")
        self.assertEqual(w2[0]["hold"]["since"], "2026-10-12")
        self.assertNotIn("offCycle", w2[0]["hold"])
        # Next Monday still counts as the second reading and publishes.
        diff3, _ = _zero(w2, "2026-10-19")
        self.assertEqual([r["slug"] for r in diff3.disappeared_sponsors], ["n32-tech"])

    def test_off_cycle_first_zero_is_marked_and_ignored_next_monday(self):
        diff, w1 = _zero(_base(), "2026-10-14", off_cycle=True)
        self.assertEqual(diff.disappeared_sponsors, [])
        self.assertTrue(w1[0]["hold"]["offCycle"])
        diff2, w2 = _zero(w1, "2026-10-19")  # Monday: counts as the FIRST reading
        self.assertEqual(diff2.disappeared_sponsors, [])
        self.assertNotIn("offCycle", w2[0]["hold"])
        diff3, _ = _zero(w2, "2026-10-26")
        self.assertEqual(len(diff3.disappeared_sponsors), 1)

    def test_on_cycle_behaviour_unchanged(self):
        _, w1 = _zero(_base(), "2026-10-12")
        diff2, _ = _zero(w1, "2026-10-19")
        self.assertEqual(len(diff2.disappeared_sponsors), 1)


class TestDropRuleOffCycle(unittest.TestCase):
    def test_off_cycle_does_not_confirm_pending_drop(self):
        _, w1 = _drop([_rec(50)], [_rec(15)], "2026-10-12")
        diff, w2 = _drop(w1, [_rec(14)], "2026-10-14", off_cycle=True)
        self.assertEqual(w2[0]["ghBeneficiaries"], 50)
        self.assertEqual(w2[0]["pendingDrop"]["since"], "2026-10-12")
        self.assertEqual(diff.beneficiary_changes, [])
        _, w3 = _drop(w2, [_rec(14)], "2026-10-19")  # Monday confirms
        self.assertEqual(w3[0]["ghBeneficiaries"], 14)
        self.assertNotIn("pendingDrop", w3[0])

    def test_off_cycle_first_drop_marked_and_ignored(self):
        _, w1 = _drop([_rec(50)], [_rec(15)], "2026-10-14", off_cycle=True)
        self.assertTrue(w1[0]["pendingDrop"]["offCycle"])
        _, w2 = _drop(w1, [_rec(15)], "2026-10-19")  # Monday = first reading
        self.assertEqual(w2[0]["ghBeneficiaries"], 50)
        self.assertNotIn("offCycle", w2[0]["pendingDrop"])


if __name__ == "__main__":
    unittest.main()


class TestOffCycleReappearance(unittest.TestCase):
    def test_reappearing_keeps_pending_zero_hold(self):
        _, w1 = _zero(_base(), "2026-10-12")  # Monday: first zero, held
        cur = _base()  # back on Wednesday
        diff = diff_snapshots(cur, w1, baseline_kind="weekly", baseline_path="w.json", coverage=COV)
        out = apply_holds(diff, cur, w1, [], run_date="2026-10-14", off_cycle=True)
        self.assertEqual(out[0]["hold"], {k: v for k, v in w1[0]["hold"].items()})
        self.assertEqual(out[0]["hold"]["zeroReadings"], 1)

    def test_reappearing_keeps_pending_drop(self):
        _, w1 = _drop([_rec(50)], [_rec(15)], "2026-10-12")
        _, w2 = _drop(w1, [_rec(49)], "2026-10-14", off_cycle=True)  # recovered mid-week
        self.assertEqual(w2[0]["pendingDrop"], w1[0]["pendingDrop"])
        self.assertEqual(w2[0]["ghBeneficiaries"], 50)

    def test_legacy_true_hold_fails_closed_off_cycle(self):
        base = _base(hold=True)
        diff, out = _zero(base, "2026-10-14", off_cycle=True)
        self.assertEqual(diff.disappeared_sponsors, [])
        self.assertEqual(out[0]["hold"]["kind"], "zero_reading")


class TestBaselineSkipsOffCycle(unittest.TestCase):
    def test_load_baseline_ignores_off_cycle_file(self):
        import json
        import tempfile
        from pathlib import Path

        from scripts.weekly.diff import load_baseline

        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            (p / "2026-10-12.json").write_text(json.dumps({"date": "2026-10-12", "companies": [{"slug": "a"}]}))
            (p / "2026-10-14.json").write_text(json.dumps({"date": "2026-10-14", "offCycle": True, "companies": [{"slug": "b"}]}))
            kind, path, comps = load_baseline(p, p / "nope.json", run_date="2026-10-19")
        self.assertEqual(kind, "weekly")
        self.assertTrue(path.endswith("2026-10-12.json"))
        self.assertEqual([c["slug"] for c in comps], ["a"])


class TestReapplyRulesOffCycle(unittest.TestCase):
    def test_reapply_honours_offcycle_marker(self):
        import json
        import tempfile
        from pathlib import Path
        from unittest import mock

        from scripts.weekly import reapply_rules

        _, w1 = _drop([_rec(50)], [_rec(15)], "2026-10-12")  # pending drop on Monday
        payload = {"date": "2026-10-14", "offCycle": True, "companies": [_rec(14)],
                   "diff": {"baseline_kind": "weekly", "baseline_path": "w.json"}}
        with tempfile.TemporaryDirectory() as d:
            p, b = Path(d) / "2026-10-14.json", Path(d) / "2026-10-12.json"
            p.write_text(json.dumps(payload))
            b.write_text(json.dumps({"date": "2026-10-12", "companies": w1}))
            with mock.patch.object(reapply_rules, "render_markdown", return_value=""):
                self.assertEqual(reapply_rules.main([str(p), str(b)]), 0)
            out = json.loads(p.read_text())
        rec = out["companies"][0]
        self.assertEqual(rec["ghBeneficiaries"], 50)  # not confirmed off-cycle
        self.assertEqual(rec["pendingDrop"]["since"], "2026-10-12")
