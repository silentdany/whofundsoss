"""QA blocker tests (OC dedupe, generic hosts, OSP latest year, empty GH)."""
from __future__ import annotations

import json
import unittest
from unittest import mock

from scripts.weekly.denylist import ExclusionEntry, is_excluded
from scripts.weekly.diff import CoverageReport, diff_snapshots
from scripts.weekly.generic_hosts import is_generic_host
from scripts.weekly.normalize import build_catalog_index, normalize_domain, passes_retention
from scripts.weekly.sources.open_collective import fetch_oc_org_backers
from scripts.weekly.sources.open_source_pledge import parse_member_page


class TestOcDedupe(unittest.TestCase):
    def test_dedupe_membership_rows_same_total(self):
        fake = [
            {
                "MemberId": 1, "name": "AG Grid", "slug": None, "role": "BACKER",
                "totalAmountDonated": 267500, "currency": "USD",
                "website": "https://www.ag-grid.com/",
                "profile": "https://opencollective.com/ag-grid",
            },
            {
                "MemberId": 2, "name": "AG Grid", "slug": None, "role": "BACKER",
                "totalAmountDonated": 267500, "currency": "USD",
                "website": "https://www.ag-grid.com/",
                "profile": "https://opencollective.com/ag-grid",
            },
            {
                "MemberId": 3, "name": "AG Grid", "slug": None, "role": "BACKER",
                "totalAmountDonated": 267500, "currency": "USD",
                "website": "https://www.ag-grid.com/",
                "profile": "https://opencollective.com/ag-grid",
            },
        ]

        class Resp:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                pass

            def read(self):
                return json.dumps(fake).encode()

        with mock.patch("urllib.request.urlopen", return_value=Resp()):
            rows, non_usd = fetch_oc_org_backers("webpack")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["publicUsd"], 267500.0)
        self.assertEqual(non_usd, [])
        self.assertEqual(rows[0]["ocSlug"], "ag-grid")

    def test_non_usd_not_added_to_usd(self):
        fake = [
            {
                "MemberId": 1, "name": "EuroCo", "slug": "euroco", "role": "BACKER",
                "totalAmountDonated": 1000, "currency": "EUR",
                "website": "https://euroco.example/",
                "profile": "https://opencollective.com/euroco",
            },
        ]

        class Resp:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                pass

            def read(self):
                return json.dumps(fake).encode()

        with mock.patch("urllib.request.urlopen", return_value=Resp()):
            rows, non_usd = fetch_oc_org_backers("webpack")
        self.assertEqual(len(non_usd), 1)
        self.assertEqual(non_usd[0]["currency"], "EUR")
        self.assertIsNone(rows[0]["publicUsd"])


class TestGenericHostAliases(unittest.TestCase):
    def test_alias_collision_cases(self):
        self.assertTrue(is_generic_host("opencollective.com"))
        self.assertTrue(is_generic_host("trustpilot.com"))
        self.assertTrue(is_generic_host("de.trustpilot.com"))
        self.assertTrue(is_generic_host("github.com"))
        self.assertTrue(is_generic_host("medium.com"))
        self.assertIsNone(normalize_domain("https://opencollective.com/ag-grid"))
        self.assertEqual(normalize_domain("https://www.ag-grid.com/path"), "ag-grid.com")

        catalog = {
            "index": [
                {
                    "slug": "instagram-story-viewer",
                    "name": "Instagram Story Viewer",
                    "site": "https://opencollective.com/instagram-story-viewer",
                    "sources": ["oc"],
                },
                {
                    "slug": "movers-to-puerto-rico",
                    "name": "Movers",
                    "site": "https://www.trustpilot.com/review/foo",
                    "sources": ["oc"],
                },
                {"slug": "github", "name": "GitHub", "site": "https://github.com", "sources": ["gh"]},
                {"slug": "ag-grid", "name": "AG Grid", "site": "https://ag-grid.com", "sources": ["oc"]},
            ],
            "details": {},
        }
        idx = build_catalog_index(catalog)
        self.assertNotEqual(
            idx.resolve(name="ligr systems", site="https://opencollective.com/haylltd", oc_slug="haylltd"),
            "instagram-story-viewer",
        )
        self.assertEqual(idx.resolve(site="https://www.ag-grid.com/pricing"), "ag-grid")
        self.assertNotEqual(idx.resolve(site="https://evil-ag-grid.com"), "ag-grid")


class TestOspLatestYear(unittest.TestCase):
    def test_most_recent_year_not_max(self):
        html = (
            "<title>Convex | Open Source Pledge</title>"
            '<section class="annual-report section--tight">'
            "<h2>2025 report · submitted</h2><p>$60,000 annual</p><p>$5,455 per</p>"
            "</section>"
            '<section class="annual-report section--tight">'
            "<h2>2024 report · submitted</h2><p>$100,000 annual</p><p>$7,692 per</p>"
            "</section>"
        )
        row = parse_member_page("convex", html)
        self.assertEqual(row["publicUsd"], 60000.0)
        self.assertEqual(row["ospReportYear"], 2025)


class TestEmptyGhSeedSkipped(unittest.TestCase):
    def test_zero_beneficiaries_gh_only_fails_retention(self):
        self.assertFalse(
            passes_retention({
                "slug": "cloudflare",
                "sources": ["gh"],
                "ghBeneficiaries": 0,
                "beneficiaries": [],
            })
        )
        self.assertTrue(
            passes_retention({
                "slug": "vercel",
                "sources": ["gh"],
                "ghBeneficiaries": 3,
                "beneficiaries": [{"login": "a"}],
            })
        )


class TestDenylistExactDomain(unittest.TestCase):
    def test_exclusion_exact_domain_not_substring(self):
        exclusions = [
            ExclusionEntry(
                entreprise="Casino",
                login_github="",
                site="https://de.trustpilot.com/review/foocasino.com",
                total_public_connu_usd=0,
                nb_beneficiaires_github=0,
                exclusion_raison="spam_casino",
                date_verif="2026-10-05",
            )
        ]
        self.assertIsNone(
            is_excluded(
                slug="innocent",
                name="Innocent",
                site="https://innocent.example/",
                denylist={},
                exclusions=exclusions,
            )
        )


class TestDiffSort(unittest.TestCase):
    def test_amount_changes_sorted_by_abs_delta(self):
        cur = [
            {
                "slug": "a",
                "name": "A",
                "sources": ["oc"],
                "publicUsdBySource": {"oc": 100, "osp": None, "gh": None, "own": None},
            },
            {
                "slug": "b",
                "name": "B",
                "sources": ["oc"],
                "publicUsdBySource": {"oc": 1000, "osp": None, "gh": None, "own": None},
            },
        ]
        base = [
            {
                "slug": "a",
                "name": "A",
                "sources": ["oc"],
                "publicUsdBySource": {"oc": 90, "osp": None, "gh": None, "own": None},
            },
            {
                "slug": "b",
                "name": "B",
                "sources": ["oc"],
                "publicUsdBySource": {"oc": 500, "osp": None, "gh": None, "own": None},
            },
        ]
        cov = CoverageReport(
            sources={
                "open_collective": {
                    "full": True,
                    "status": "ok",
                    "capped": False,
                    "meta": {"ok_collective_slugs": ["webpack"]},
                }
            }
        )
        d = diff_snapshots(cur, base, baseline_kind="weekly", baseline_path="data/weekly/x.json", coverage=cov)
        self.assertGreaterEqual(abs(d.amount_changes[0]["delta"]), abs(d.amount_changes[-1]["delta"]))
        self.assertEqual(d.amount_changes[0]["slug"], "b")


if __name__ == "__main__":
    unittest.main()
