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
