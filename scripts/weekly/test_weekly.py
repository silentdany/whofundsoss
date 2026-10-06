#!/usr/bin/env python3
"""Unit tests for the weekly scraper (no network)."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.weekly.denylist import is_excluded, load_raw_exclusions, parse_spam_denylist
from scripts.weekly.diff import catalog_as_companies, diff_snapshots
from scripts.weekly.report import merge_companies, render_markdown
from scripts.weekly.sources.base import SourceResult
from scripts.weekly.suspects import flag_suspects


class TestDenylistParse(unittest.TestCase):
    def test_parse_live_denylist(self):
        version, entries = parse_spam_denylist()
        self.assertTrue(version)
        self.assertGreaterEqual(len(entries), 50)
        self.assertIn("uudetkasinot-com", entries)
        self.assertEqual(entries["uudetkasinot-com"].category, "gambling")

    def test_parse_rejects_empty(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "empty.ts"
            p.write_text("export const SPAM_DENYLIST_VERSION = \"x\";\nexport const SPAM_DENYLIST = {};\n")
            with self.assertRaises(ValueError):
                parse_spam_denylist(p)

    def test_raw_exclusions_count(self):
        rows = load_raw_exclusions()
        self.assertEqual(len(rows), 120)  # 119 spam + 1 supabase_self_fund

    def test_is_excluded_denylist(self):
        _, entries = parse_spam_denylist()
        reason = is_excluded(slug="socialboosting", denylist=entries, exclusions=[])
        self.assertIsNotNone(reason)
        self.assertIn("denylist", reason or "")
        self.assertIsNone(is_excluded(slug="getsentry", denylist=entries, exclusions=[]))


class TestSuspects(unittest.TestCase):
    def test_flag_only_never_drops(self):
        companies = [
            {"slug": "acme-casino", "name": "Acme Casino", "site": "https://acme.example"},
            {"slug": "getsentry", "name": "Sentry", "site": "https://sentry.io"},
            {"slug": "plain-co", "name": "Plain Co", "site": "https://plain.example"},
        ]
        hits = flag_suspects(companies, denylist_slugs={"acme-casino"})
        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0].slug, "acme-casino")
        self.assertTrue(hits[0].already_denylisted)
        # original list untouched
        self.assertEqual(len(companies), 3)

    def test_allowlist_skips_sentry(self):
        hits = flag_suspects([{"slug": "getsentry", "name": "Sentry Betting Labs", "site": ""}])
        self.assertEqual(hits, [])


class TestDiff(unittest.TestCase):
    def test_new_and_disappeared_and_amount(self):
        baseline = [
            {"slug": "a", "name": "A", "publicUsd": 100, "ghBeneficiaries": 2, "beneficiaries": [{"login": "x"}]},
            {"slug": "b", "name": "B", "publicUsd": 50},
        ]
        current = [
            {"slug": "a", "name": "A", "publicUsd": 150, "ghBeneficiaries": 3, "beneficiaries": [{"login": "x"}, {"login": "y"}]},
            {"slug": "c", "name": "C", "publicUsd": 10},
        ]
        d = diff_snapshots(current, baseline, baseline_kind="weekly", baseline_path="x.json")
        self.assertEqual([x["slug"] for x in d.new_sponsors], ["c"])
        self.assertEqual([x["slug"] for x in d.disappeared_sponsors], ["b"])
        self.assertEqual(d.amount_changes[0]["delta"], 50)
        self.assertEqual(d.beneficiary_changes[0]["to"], 3)
        self.assertEqual(d.new_sponsorships[0]["beneficiary"], "y")

    def test_null_amounts_not_treated_as_zero(self):
        baseline = [{"slug": "a", "publicUsd": None}]
        current = [{"slug": "a", "publicUsd": None}]
        d = diff_snapshots(current, baseline, baseline_kind="none", baseline_path=None)
        self.assertEqual(d.amount_changes, [])
        # Introducing a real number vs null is NOT an amount change (no invented baseline 0)
        current2 = [{"slug": "a", "publicUsd": 100}]
        d2 = diff_snapshots(current2, baseline, baseline_kind="none", baseline_path=None)
        self.assertEqual(d2.amount_changes, [])

    def test_catalog_as_companies(self):
        catalog = {"index": [{"slug": "vercel", "name": "Vercel", "publicUsd": 1, "sources": ["gh"], "ghBeneficiaries": 4}]}
        rows = catalog_as_companies(catalog)
        self.assertEqual(rows[0]["slug"], "vercel")
        self.assertEqual(rows[0]["sources"], ["gh"])


class TestSourceFailureSemantics(unittest.TestCase):
    def test_unavailable_source_contributes_no_silent_zero(self):
        bad = SourceResult(name="github_sponsors", status="unavailable", error="boom", items=[])
        good = SourceResult(
            name="open_source_pledge",
            status="ok",
            items=[{"slug": "sentry", "name": "Sentry", "source": "osp", "publicUsd": 750000}],
        )
        merged = merge_companies([bad, good])
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["publicUsd"], 750000)
        # unavailable count must be None in to_dict, never 0-as-success
        d = bad.to_dict()
        self.assertIsNone(d["count"])
        self.assertEqual(d["status"], "unavailable")

    def test_markdown_marks_unavailable(self):
        payload = {
            "date": "2026-10-06",
            "durationSeconds": 1.2,
            "sources": [
                {"name": "github_sponsors", "status": "unavailable", "error": "no token", "count": None, "meta": {}},
                {"name": "open_collective", "status": "ok", "count": 3, "meta": {"ok_collectives": 3}},
            ],
            "diff": {
                "baseline_kind": "catalog",
                "baseline_path": "src/data/catalog.json",
                "counts": {
                    "new_sponsors": 0,
                    "disappeared_sponsors": 0,
                    "new_sponsorships": 0,
                    "amount_changes": 0,
                    "beneficiary_changes": 0,
                },
                "new_sponsors": [],
                "disappeared_sponsors": [],
                "new_sponsorships": [],
                "amount_changes": [],
                "beneficiary_changes": [],
            },
            "suspects": [],
            "denylist": {"version": "test", "count": 1},
            "exclusions": {"count": 119},
            "excludedNoted": [],
            "notes": ["x"],
        }
        md = render_markdown(payload)
        self.assertIn("source unavailable", md)
        self.assertIn("github_sponsors", md)


if __name__ == "__main__":
    unittest.main()
