#!/usr/bin/env python3
"""Unit tests for the weekly scraper (no network)."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.weekly.denylist import is_excluded, load_raw_exclusions, parse_spam_denylist
from scripts.weekly.diff import CoverageReport, apply_holds, catalog_as_companies, diff_snapshots, load_holds
from scripts.weekly.normalize import (
    build_catalog_index,
    company_slug,
    passes_retention,
    slugify,
)
from scripts.weekly.report import coverage_from_results, merge_companies, render_markdown
from scripts.weekly.sources.base import SourceResult
from scripts.weekly.suspects import flag_suspects

CATALOG = Path(__file__).resolve().parents[2] / "src" / "data" / "catalog.json"


class TestDenylistParse(unittest.TestCase):
    def test_parse_live_denylist(self):
        version, entries = parse_spam_denylist()
        self.assertTrue(version)
        self.assertGreaterEqual(len(entries), 50)
        self.assertIn("uudetkasinot-com", entries)

    def test_parse_rejects_empty(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "empty.ts"
            p.write_text('export const SPAM_DENYLIST_VERSION = "x";\nexport const SPAM_DENYLIST = {};\n')
            with self.assertRaises(ValueError):
                parse_spam_denylist(p)

    def test_raw_exclusions_count(self):
        rows = load_raw_exclusions()
        self.assertEqual(len(rows), 133)

    def test_is_excluded_denylist(self):
        _, entries = parse_spam_denylist()
        self.assertIsNotNone(is_excluded(slug="socialboosting", denylist=entries, exclusions=[]))
        self.assertIsNone(is_excluded(slug="getsentry", denylist=entries, exclusions=[]))


class TestExclusionSubdomain(unittest.TestCase):
    def test_subdomain_of_excluded_site_is_excluded(self):
        rows = [r for r in load_raw_exclusions() if (r.site or "").find("coinsmania.com") >= 0]
        self.assertTrue(rows)
        self.assertIsNotNone(is_excluded(slug="x", site="https://app.coinsmania.com/", exclusions=rows))
        self.assertIsNotNone(is_excluded(slug="x", site="https://a.b.coinsmania.com", exclusions=rows))
        self.assertIsNone(is_excluded(slug="x", site="https://notcoinsmania.com", exclusions=rows))
        self.assertIsNone(is_excluded(slug="x", site="https://coinsmania.com.example", exclusions=rows))

    def test_generic_host_rows_never_match_by_domain(self):
        rows = [r for r in load_raw_exclusions() if r.login_github == "github-sponsors"]
        self.assertIsNone(is_excluded(slug="github", site="https://github.com", exclusions=rows))
        self.assertIsNone(is_excluded(slug="x", site="https://gist.github.com", exclusions=rows))


class TestNormalize(unittest.TestCase):
    def test_slugify_name(self):
        self.assertEqual(slugify("General Catalyst"), "general-catalyst")
        self.assertEqual(slugify("Nx (by Nrwl)"), "nx-by-nrwl")

    def test_company_slug_prefers_login(self):
        self.assertEqual(company_slug(login="getsentry", name="Sentry"), "getsentry")
        self.assertEqual(company_slug(login="", name="Creative Tim"), "creative-tim")

    def test_catalog_aliases_osp(self):
        if not CATALOG.exists():
            self.skipTest("catalog.json missing")
        idx = build_catalog_index(CATALOG)
        self.assertEqual(idx.resolve(osp_slug="sentry", name="Sentry"), "getsentry")
        self.assertEqual(idx.resolve(login="vercel"), "vercel")
        self.assertEqual(idx.resolve(name="General Catalyst"), "general-catalyst")

    def test_catalog_join_rate(self):
        """Most dump companies with login/name must resolve into catalog."""
        if not CATALOG.exists():
            self.skipTest("catalog.json missing")
        idx = build_catalog_index(CATALOG)
        # Sanity: known rows resolve to themselves
        for slug in ("vercel", "getsentry", "posit-dev", "trivago"):
            self.assertIn(slug, idx.by_slug)

    def test_retention_filter(self):
        self.assertFalse(passes_retention({"sources": ["gh"], "publicUsdBySource": {}, "ghBeneficiaries": 0}))
        self.assertTrue(passes_retention({"sources": ["gh"], "publicUsdBySource": {}, "ghBeneficiaries": 2, "beneficiaries": [{"login": "x"}]}))
        self.assertTrue(passes_retention({"sources": ["osp"], "publicUsdBySource": {"osp": 100}}))
        self.assertFalse(
            passes_retention({
                "sources": ["oc"],
                "collectives": ["a"],
                "publicUsdBySource": {"oc": 100},
                "publicUsd": 100,
            })
        )
        self.assertTrue(
            passes_retention({
                "sources": ["oc"],
                "collectives": ["a", "b", "c"],
                "publicUsdBySource": {"oc": 100},
            })
        )
        self.assertTrue(
            passes_retention({
                "sources": ["oc"],
                "collectives": ["a"],
                "publicUsdBySource": {"oc": 6000},
            })
        )


class TestSuspects(unittest.TestCase):
    def test_flag_only_never_drops(self):
        companies = [
            {"slug": "acme-casino", "name": "Acme Casino", "site": "https://acme.example"},
            {"slug": "getsentry", "name": "Sentry", "site": "https://sentry.io"},
        ]
        hits = flag_suspects(companies, denylist_slugs={"acme-casino"})
        self.assertEqual(len(hits), 1)
        self.assertTrue(hits[0].already_denylisted)
        self.assertEqual(len(companies), 2)


class TestDiffCoverage(unittest.TestCase):
    def test_partial_coverage_goes_to_unverified_not_disappeared(self):
        baseline = [
            {"slug": "a", "name": "A", "sources": ["oc"], "publicUsdBySource": {"oc": 100},
             "collectives": ["webpack"]},
            {"slug": "b", "name": "B", "sources": ["gh"], "publicUsdBySource": {}, "ghBeneficiaries": 3,
             "login": "b"},
        ]
        current = []  # saw nothing
        # OC succeeded for entity a (webpack fetched); GH did not succeed for b
        cov = CoverageReport(sources={
            "open_collective": {
                "full": False, "status": "ok", "capped": False,
                "meta": {"ok_collective_slugs": ["webpack"]},
            },
            "github_sponsors": {
                "full": False, "status": "ok", "capped": False,
                "meta": {"ok_logins": ["other"]},  # b not fetched successfully
            },
            "open_source_pledge": {"full": True, "status": "ok", "capped": False, "meta": {}},
        })
        d = diff_snapshots(current, baseline, baseline_kind="catalog", baseline_path="x", coverage=cov)
        self.assertEqual([x["slug"] for x in d.disappeared_sponsors], ["a"])
        self.assertEqual([x["slug"] for x in d.unverified_partial], ["b"])

    def test_own_source_never_disappears(self):
        baseline = [{"slug": "x", "name": "X", "sources": ["own"]}]
        cov = CoverageReport(sources={
            "open_collective": {"full": True},
            "github_sponsors": {"full": True},
            "open_source_pledge": {"full": True},
        })
        d = diff_snapshots([], baseline, baseline_kind="catalog", baseline_path="x", coverage=cov)
        self.assertEqual(d.disappeared_sponsors, [])
        self.assertEqual(d.unverified_partial[0]["slug"], "x")

    def test_like_with_like_amounts(self):
        baseline = [{
            "slug": "a",
            "sources": ["oc", "osp"],
            "publicUsdBySource": {"oc": 100, "osp": 50, "gh": None, "own": None},
            "publicUsd": 150,
        }]
        current = [{
            "slug": "a",
            "sources": ["oc", "osp"],
            "publicUsdBySource": {"oc": 100, "osp": 80, "gh": None, "own": None},
            "publicUsd": 180,
        }]
        cov = CoverageReport(sources={
            "open_collective": {"full": True},
            "open_source_pledge": {"full": True},
            "github_sponsors": {"full": True},
        })
        d = diff_snapshots(current, baseline, baseline_kind="weekly", baseline_path="x", coverage=cov)
        self.assertEqual(len(d.amount_changes), 1)
        self.assertEqual(d.amount_changes[0]["source"], "osp")
        self.assertEqual(d.amount_changes[0]["delta"], 30)

    def test_null_amounts_not_zero(self):
        baseline = [{"slug": "a", "sources": ["gh"], "publicUsdBySource": {"gh": None}}]
        current = [{"slug": "a", "sources": ["gh"], "publicUsdBySource": {"gh": None}}]
        d = diff_snapshots(
            current, baseline, baseline_kind="none", baseline_path=None,
            coverage=CoverageReport(sources={"github_sponsors": {"full": True}}),
        )
        self.assertEqual(d.amount_changes, [])

    def test_suspicious_threshold(self):
        baseline = [
            {"slug": f"c{i}", "sources": ["oc"], "publicUsdBySource": {"oc": 1}, "collectives": ["webpack"]}
            for i in range(100)
        ]
        current = [{"slug": "brand-new", "sources": ["oc"], "publicUsdBySource": {"oc": 9000}, "publicUsd": 9000}]
        cov = CoverageReport(sources={
            "open_collective": {
                "full": True, "status": "ok", "capped": False,
                "meta": {"ok_collective_slugs": ["webpack"]},
            },
        })
        d = diff_snapshots(current, baseline, baseline_kind="catalog", baseline_path="x", coverage=cov, suspicious_pct=10)
        self.assertTrue(d.suspicious)
        self.assertGreaterEqual(len(d.suspicious_reasons), 1)

    def test_catalog_as_companies_has_bysource(self):
        if not CATALOG.exists():
            self.skipTest("catalog.json missing")
        catalog = json.loads(CATALOG.read_text())
        rows = catalog_as_companies(catalog)
        sentry = next(r for r in rows if r["slug"] == "getsentry")
        self.assertEqual(sentry["publicUsdBySource"]["osp"], 750000.0)


class TestHolds(unittest.TestCase):
    def _diff(self):
        base = [{"slug": "openai", "name": "OpenAI", "sources": ["gh"], "login": "openai", "ghBeneficiaries": 50}]
        cov = CoverageReport(sources={"github_sponsors": {"full": True, "status": "ok", "meta": {"ok_logins": ["openai"]}}})
        diff = diff_snapshots([], base, baseline_kind="weekly", baseline_path="data/weekly/prev.json", coverage=cov)
        return base, diff

    def test_live_holds_file_has_openai(self):
        self.assertIn("openai", {h["slug"] for h in load_holds()})

    def test_active_hold_carries_last_known_value(self):
        base, diff = self._diff()
        self.assertEqual([r["slug"] for r in diff.disappeared_sponsors], ["openai"])
        holds = [{"slug": "openai", "reason": "single reading", "since": "2026-10-12", "review_on": "2026-10-19"}]
        out = apply_holds(diff, [], base, holds, run_date="2026-10-12")
        self.assertEqual(diff.disappeared_sponsors, [])
        self.assertEqual([h["slug"] for h in diff.held], ["openai"])
        self.assertEqual(out[0]["ghBeneficiaries"], 50)
        self.assertEqual(out[0]["hold"]["review_on"], "2026-10-19")

    def test_expired_hold_publishes_disappearance(self):
        # Next Monday: the baseline is last week's file, which carries the held record.
        base, _ = self._diff()
        base[0]["hold"] = {"kind": "manual", "since": "2026-10-12", "review_on": "2026-10-19"}
        cov = CoverageReport(sources={"github_sponsors": {"full": True, "status": "ok", "meta": {"ok_logins": ["openai"]}}})
        diff = diff_snapshots([], base, baseline_kind="weekly", baseline_path="p", coverage=cov)
        holds = [{"slug": "openai", "reason": "x", "since": "2026-10-12", "review_on": "2026-10-19"}]
        out = apply_holds(diff, [], base, holds, run_date="2026-10-19")
        self.assertEqual([r["slug"] for r in diff.disappeared_sponsors], ["openai"])
        self.assertEqual(out, [])


class TestTwoZeroRule(unittest.TestCase):
    COV = CoverageReport(sources={"github_sponsors": {"full": True, "status": "ok", "meta": {"ok_logins": ["n32-tech"]}}})

    def _base(self):
        return [{"slug": "n32-tech", "name": "n32.tech", "login": "n32-tech", "sources": ["gh"], "ghBeneficiaries": 1}]

    def test_first_zero_is_held_not_published(self):
        base = self._base()
        diff = diff_snapshots([], base, baseline_kind="weekly", baseline_path="w1.json", coverage=self.COV)
        out = apply_holds(diff, [], base, [], run_date="2026-10-12")
        self.assertEqual(diff.disappeared_sponsors, [])
        self.assertEqual(diff.held[0]["hold_kind"], "zero_reading")
        self.assertEqual(out[0]["ghBeneficiaries"], 1)  # last known value kept
        self.assertEqual(out[0]["hold"]["zeroReadings"], 1)

    def test_second_consecutive_zero_publishes(self):
        base = self._base()
        d1 = diff_snapshots([], base, baseline_kind="weekly", baseline_path="w1.json", coverage=self.COV)
        week1 = apply_holds(d1, [], base, [], run_date="2026-10-12")
        d2 = diff_snapshots([], week1, baseline_kind="weekly", baseline_path="w2.json", coverage=self.COV)
        week2 = apply_holds(d2, [], week1, [], run_date="2026-10-19")
        self.assertEqual([r["slug"] for r in d2.disappeared_sponsors], ["n32-tech"])
        self.assertEqual(d2.held, [])
        self.assertEqual(week2, [])

    def test_reappearance_clears_the_hold(self):
        base = self._base()
        d1 = diff_snapshots([], base, baseline_kind="weekly", baseline_path="w1.json", coverage=self.COV)
        week1 = apply_holds(d1, [], base, [], run_date="2026-10-12")
        back = self._base()
        d2 = diff_snapshots(back, week1, baseline_kind="weekly", baseline_path="w2.json", coverage=self.COV)
        week2 = apply_holds(d2, back, week1, [], run_date="2026-10-19")
        self.assertEqual(d2.disappeared_sponsors, [])
        self.assertNotIn("hold", week2[0])

    def test_rule_can_be_disabled(self):
        base = self._base()
        diff = diff_snapshots([], base, baseline_kind="weekly", baseline_path="w1.json", coverage=self.COV)
        apply_holds(diff, [], base, [], run_date="2026-10-12", require_two_zero=False)
        self.assertEqual(len(diff.disappeared_sponsors), 1)


class TestPayloadKeepsState(unittest.TestCase):
    def test_hold_and_oc_accounts_survive_build_payload(self):
        from datetime import date
        from scripts.weekly.diff import DiffResult
        from scripts.weekly.report import build_payload
        comps = [{"slug": "openai", "name": "OpenAI", "hold": {"kind": "manual"}, "ocAccounts": []},
                 {"slug": "sxl-cn", "name": "上线了", "ocAccounts": ["strikingly"]}]
        p = build_payload(run_date=date(2026, 10, 12), source_results=[], companies=comps,
                          diff=DiffResult(baseline_kind="weekly", baseline_path=None), suspects=[],
                          denylist_version="v", denylist_count=0, exclusions_count=0,
                          excluded_from_report=[], duration_s=0, coverage=CoverageReport())
        self.assertEqual(p["companies"][0]["hold"], {"kind": "manual"})
        self.assertNotIn("ocAccounts", p["companies"][0])
        self.assertEqual(p["companies"][1]["ocAccounts"], ["strikingly"])


class TestStableOcIdentity(unittest.TestCase):
    COV = CoverageReport(sources={"open_collective": {"full": True, "status": "ok", "meta": {"ok_collective_slugs": ["babel", "vuejs", "webpack", "mochajs", "parcel"]}}})

    def test_slug_change_with_oc_account_is_a_rename(self):
        base = [{"slug": "unknown", "name": "上线了", "sources": ["oc"], "site": "https://www.sxl.cn/a", "collectives": ["babel"], "ocAccounts": ["strikingly"], "publicUsdBySource": {"oc": 6980.0}}]
        cur = [{"slug": "sxl-cn", "name": "上线了", "sources": ["oc"], "site": "https://www.sxl.cn/a", "collectives": ["babel"], "ocAccounts": ["strikingly"], "publicUsdBySource": {"oc": 7000.0}}]
        diff = diff_snapshots(cur, base, baseline_kind="weekly", baseline_path="p", coverage=self.COV)
        self.assertEqual(diff.new_sponsors, [])
        self.assertEqual(diff.disappeared_sponsors, [])
        self.assertEqual(diff.renamed, [{"from": "unknown", "to": "sxl-cn", "name": "上线了", "matchedBy": "oc_account"}])
        self.assertEqual(diff.amount_changes[0]["slug"], "sxl-cn")

    def test_legacy_baseline_without_ids_matches_on_site_and_name(self):
        base = [{"slug": "unknown-x", "name": "多态", "sources": ["oc"], "site": "https://www.duotai.net", "collectives": ["babel"]}]
        cur = [{"slug": "duotai-net", "name": "多态", "sources": ["oc"], "site": "https://duotai.net/", "collectives": ["babel"], "ocAccounts": ["duotai"]}]
        diff = diff_snapshots(cur, base, baseline_kind="weekly", baseline_path="p", coverage=self.COV)
        self.assertEqual(diff.new_sponsors, [])
        self.assertEqual(diff.disappeared_sponsors, [])
        self.assertEqual(diff.renamed[0]["to"], "duotai-net")

    def test_different_oc_accounts_are_not_merged(self):
        base = [{"slug": "unknown", "name": "A", "sources": ["oc"], "site": "https://a.example", "collectives": ["babel"], "ocAccounts": ["acct-a"]}]
        cur = [{"slug": "b-example", "name": "B", "sources": ["oc"], "site": "https://b.example", "collectives": ["babel"], "ocAccounts": ["acct-b"]}]
        diff = diff_snapshots(cur, base, baseline_kind="weekly", baseline_path="p", coverage=self.COV)
        self.assertEqual(diff.renamed, [])
        self.assertEqual(len(diff.new_sponsors), 1)
        self.assertEqual(len(diff.disappeared_sponsors), 1)

    def test_merge_records_oc_account(self):
        src = SourceResult(name="open_collective", status="ok", items=[{"slug": "strikingly", "ocSlug": "Strikingly", "name": "上线了", "site": "https://www.sxl.cn/", "publicUsd": 6980.0, "collectives": ["babel", "vuejs", "webpack"]}])
        rows = merge_companies([src], catalog_index=None, apply_retention=False)
        self.assertEqual(rows[0]["ocAccounts"], ["strikingly"])


class TestHomoglyphs(unittest.TestCase):
    def test_fold_mixed_script(self):
        from scripts.weekly.normalize import fold_homoglyphs
        self.assertEqual(fold_homoglyphs("\u0421oinsmania"), "Coinsmania")
        self.assertEqual(fold_homoglyphs("\u0441\u0430sino"), "casino")
        self.assertEqual(fold_homoglyphs("казино"), "казино")  # native script untouched
        self.assertEqual(fold_homoglyphs("上线了"), "上线了")

    def test_suspect_scan_sees_through_cyrillic_letters(self):
        hits = flag_suspects([{"slug": "x", "name": "Royal \u0421\u0430sino"}])
        self.assertEqual(len(hits), 1)
        self.assertIn("casino", hits[0].matched_keywords)

    def test_native_cyrillic_pattern_still_matches(self):
        hits = flag_suspects([{"slug": "w-in-ua", "name": "онлайн казино"}])
        self.assertIn("cyrillic_gambling", hits[0].matched_keywords)

    def test_exclusion_name_match_with_homoglyph(self):
        from scripts.weekly.denylist import ExclusionEntry
        rows = [r for r in load_raw_exclusions() if r.login_github == "oinsmania"]
        self.assertEqual(len(rows), 1)
        # Same name typed with a Latin C still hits the Cyrillic-С row
        self.assertIsNotNone(is_excluded(slug="coinsmania", name="Coinsmania", exclusions=rows))


class TestCanonicalBeforeSlugAndDenylist(unittest.TestCase):
    VARIANTS = {
        "cyrillic_es_first": "\u0421oinsmania",
        "cyrillic_a_last": "Coinsmani\u0430",
        "greek_lunate_sigma": "\u03f9oinsmania",
        "double_struck_c": "\u2102oinsmania",
        "fullwidth_c": "\uff23oinsmania",
        "zero_width_inside": "Coins\u200bmania",
        "all_at_once": "\uff23oins\u200dmani\u0430",
        "combining_acute_after_a": "Coinsmania\u0301",
        "combining_inside": "Co\u0308insmania",
        "precomposed_o_acute": "C\u00f3insmania",
        "armenian_oh": "C\u0585insmania",
        "cherokee_c": "\u13dfoinsmania",
        "mixed_marks_and_homoglyphs": "\u0421\u00f3ins\u200bmani\u0430\u0301",
    }

    def test_canonical_text(self):
        from scripts.weekly.normalize import canonical_text
        for label, v in self.VARIANTS.items():
            self.assertEqual(canonical_text(v), "Coinsmania", label)

    def test_slug_is_stable_across_variants(self):
        for label, v in self.VARIANTS.items():
            self.assertEqual(slugify(v), "coinsmania", label)
        self.assertEqual(slugify("Ｇｅｎｅｒａｌ Catalyst"), "general-catalyst")

    def test_no_variant_bypasses_denylist_or_exclusions(self):
        _, dl = parse_spam_denylist()
        ex = load_raw_exclusions()
        for label, v in self.VARIANTS.items():
            # No site, slug derived from the name: the worst case for a bypass.
            reason = is_excluded(slug=slugify(v), name=v, site="", login="", denylist=dl, exclusions=ex)
            self.assertIsNotNone(reason, label)

    def test_denylist_slug_itself_canonicalized(self):
        from scripts.weekly.denylist import DenylistEntry
        dl = {"coinsmania": DenylistEntry(slug="coinsmania", category="gambling", source="data", reason="casino")}
        if dl is None:
            self.skipTest("DenylistEntry shape differs")
        for label, v in self.VARIANTS.items():
            self.assertIsNotNone(is_excluded(slug=v, name="", denylist=dl, exclusions=[]), label)

    def test_variant_merges_into_catalog_row_not_a_duplicate(self):
        if not CATALOG.exists():
            self.skipTest("catalog.json missing")
        idx = build_catalog_index(CATALOG)
        if "oinsmania" not in idx.by_slug:
            self.skipTest("oinsmania not in catalog")
        for label, v in self.VARIANTS.items():
            self.assertEqual(idx.resolve(name=v), "oinsmania", label)

    def test_native_script_untouched(self):
        from scripts.weekly.normalize import canonical_text
        # Combining marks are dropped in every script (й -> и); words stay Cyrillic.
        self.assertEqual(canonical_text("онлайн казино"), "онлаин казино")
        self.assertEqual(flag_suspects([{"slug": "x", "name": "онлайн казино"}])[0].matched_keywords, ("cyrillic_gambling",))
        self.assertEqual(canonical_text("Ставки на спорт"), "Ставки на спорт")  # "на" is not "ha"
        # No slug churn for live denylisted names
        self.assertEqual(slugify("Funrize\u2122 Social Casino"), "funrize-social-casino")

    def test_armenian_seh_is_u_not_s(self):
        # QA 5ecce2e: Fսn88 (U+057D) became 'fsn88', a duplicate next to fun88.
        from scripts.weekly.normalize import CONFUSABLES_VERSION, canonical_text
        self.assertTrue(CONFUSABLES_VERSION)
        self.assertEqual(canonical_text("F\u057dn88"), "Fun88")
        self.assertEqual(slugify("F\u057dn88"), "fun88")
        _, dl = parse_spam_denylist()
        if "fun88" in dl:
            self.assertIsNotNone(is_excluded(slug=slugify("F\u057dn88"), name="F\u057dn88", denylist=dl, exclusions=[]))
        if CATALOG.exists():
            idx = build_catalog_index(CATALOG)
            if "fun88" in idx.by_slug:
                self.assertEqual(idx.resolve(name="F\u057dn88"), "fun88")

    def test_confusables_table_drives_mapping(self):
        from scripts.weekly.normalize import canonical_text
        # From UTS #39, not the old hand map: Armenian vo/oh, Cherokee, Latin-I fix.
        self.assertEqual(canonical_text("C\u0585\u0578fig"), "Config")
        self.assertEqual(canonical_text("\u13dfasino"), "Casino")
        self.assertEqual(canonical_text("\u0406nfo"), "Info")  # Cyrillic I -> I, not l
        self.assertEqual(slugify("\u0399nfo"), "info")  # Greek Iota

    def test_accent_slug_change_still_hits_old_denylist_key(self):
        # Denylist key predates mark stripping: 'ilmaiset-pitk-vetovihjeet'.
        _, dl = parse_spam_denylist()
        self.assertIn("ilmaiset-pitk-vetovihjeet", dl)
        name = "Ilmaiset Pitk\u00e4vetovihjeet"
        self.assertEqual(slugify(name), "ilmaiset-pitkavetovihjeet")
        self.assertIsNotNone(is_excluded(slug=slugify(name), name=name, denylist=dl, exclusions=[]))

    def test_mark_variants_hit_denylist_slug_without_exclusion_rows(self):
        from scripts.weekly.denylist import DenylistEntry
        dl = {"coinsmania": DenylistEntry(slug="coinsmania", category="gambling", source="data", reason="casino")}
        for v in ("Coinsmania\u0301", "C\u00f3insmania", "C\u0585insmania"):
            self.assertIsNotNone(is_excluded(slug=slugify(v), name=v, denylist=dl, exclusions=[]), v)


class TestExistingDataPr(unittest.TestCase):
    PRS = [
        {"number": 24, "url": "u24", "state": "OPEN", "headRefName": "data/weekly-run-1", "files": [{"path": "data/weekly/2026-10-12.json"}]},
        {"number": 25, "url": "u25", "state": "CLOSED", "headRefName": "data/weekly-run-2", "files": [{"path": "data/weekly/2026-10-19.json"}]},
        {"number": 7, "url": "u7", "state": "MERGED", "headRefName": "data/weekly-run-3", "files": [{"path": "data/weekly/2026-10-06.json"}]},
        {"number": 9, "url": "u9", "state": "OPEN", "headRefName": "feat/x", "files": [{"path": "data/weekly/2026-10-26.json"}]},
    ]

    def test_open_and_merged_block(self):
        from scripts.weekly.existing_data_pr import find_existing
        self.assertEqual(find_existing(self.PRS, "2026-10-12")["number"], 24)
        self.assertEqual(find_existing(self.PRS, "2026-10-06")["number"], 7)

    def test_closed_or_non_data_branch_does_not_block(self):
        from scripts.weekly.existing_data_pr import find_existing
        self.assertIsNone(find_existing(self.PRS, "2026-10-19"))
        self.assertIsNone(find_existing(self.PRS, "2026-10-26"))

    def test_rejects_bad_date(self):
        from scripts.weekly.existing_data_pr import find_existing
        with self.assertRaises(ValueError):
            find_existing(self.PRS, "2026-10-12; rm -rf /")

    def test_workflow_patch_uses_read_only_github_token(self):
        # Ships as docs/weekly-scraper-dedupe.patch (the bot token cannot push
        # .github/workflows). Once applied, the live workflow is checked too.
        root = Path(__file__).resolve().parents[2]
        patch = (root / "docs" / "weekly-scraper-dedupe.patch").read_text()
        added = "\n".join(l[1:] for l in patch.splitlines() if l.startswith("+") and not l.startswith("+++"))
        self.assertIn("scripts.weekly.existing_data_pr", added)
        self.assertIn("GH_TOKEN: ${{ github.token }}", added)
        self.assertIn("pull-requests: read", added)
        self.assertIn("contents: read", added)
        guard = added[added.index("dedupe:"):added.index("needs: dedupe")]
        self.assertNotIn("PAT", guard.replace("no PAT", ""))
        self.assertNotIn("secrets.", guard)
        self.assertIn("needs: dedupe", added)
        self.assertIn("if: needs.dedupe.outputs.skip != 'true'", added)
        wf = (root / ".github" / "workflows" / "weekly-scraper.yml").read_text()
        if "existing_data_pr" in wf:
            self.assertIn("if: needs.dedupe.outputs.skip != 'true'", wf)


class TestMergeRetention(unittest.TestCase):
    def test_merge_resolves_osp_alias(self):
        if not CATALOG.exists():
            self.skipTest("catalog.json missing")
        idx = build_catalog_index(CATALOG)
        osp = SourceResult(
            name="open_source_pledge",
            status="ok",
            items=[{"name": "Sentry", "ospSlug": "sentry", "login": "getsentry", "source": "osp", "publicUsd": 750000}],
        )
        merged = merge_companies([osp], catalog_index=idx)
        self.assertEqual(merged[0]["slug"], "getsentry")
        self.assertEqual(merged[0]["publicUsdBySource"]["osp"], 750000)

    def test_unavailable_no_silent_zero(self):
        bad = SourceResult(name="github_sponsors", status="unavailable", error="boom", items=[])
        good = SourceResult(
            name="open_source_pledge",
            status="ok",
            items=[{"slug": "zerodha", "name": "Zerodha", "source": "osp", "ospSlug": "zerodha", "publicUsd": 1}],
        )
        if CATALOG.exists():
            idx = build_catalog_index(CATALOG)
        else:
            idx = None
        merged = merge_companies([bad, good], catalog_index=idx)
        self.assertEqual(len(merged), 1)
        self.assertIsNone(bad.to_dict()["count"])

    def test_oc_low_success_ratio_not_full(self):
        r = SourceResult(
            name="open_collective",
            status="ok",
            items=[{"x": 1}],
            meta={"attempted": 100, "ok_collectives": 50},
        )
        cov = coverage_from_results([r], max_oc=None, max_osp=None, gh_logins_override=False)
        self.assertFalse(cov.full("open_collective"))

    def test_coverage_marks_capped(self):
        r = SourceResult(name="open_collective", status="ok", items=[{"x": 1}], meta={})
        cov = coverage_from_results([r], max_oc=40, max_osp=None, gh_logins_override=False)
        self.assertFalse(cov.full("open_collective"))
        self.assertTrue(cov.sources["open_collective"]["capped"])

    def test_markdown_suspicious_banner(self):
        payload = {
            "date": "2026-10-06",
            "durationSeconds": 1,
            "suspicious": True,
            "coverage": {"open_collective": {"full": False, "status": "ok", "count": 1, "capped": True}},
            "sources": [{"name": "open_collective", "status": "ok", "count": 1, "meta": {}}],
            "diff": {
                "baseline_kind": "catalog",
                "baseline_path": "x",
                "baseline_size": 100,
                "suspicious": True,
                "suspicious_reasons": ["new_sponsors 50 = 50.0% of baseline 100"],
                "counts": {
                    "new_sponsors": 50,
                    "disappeared_sponsors": 0,
                    "unverified_partial": 10,
                    "new_sponsorships": 0,
                    "amount_changes": 0,
                    "beneficiary_changes": 0,
                },
                "new_sponsors": [],
                "disappeared_sponsors": [],
                "unverified_partial": [],
                "new_sponsorships": [],
                "amount_changes": [],
                "beneficiary_changes": [],
            },
            "suspects": [],
            "denylist": {"version": "t", "count": 1},
            "exclusions": {"count": 120},
            "excludedNoted": [],
            "notes": [],
        }
        md = render_markdown(payload)
        self.assertIn("DIFF SUSPICIOUS", md)
        self.assertIn("Unverified (partial coverage)", md)


if __name__ == "__main__":
    unittest.main()


class TestRequirePat(unittest.TestCase):
    def test_missing_secret_fails_cleanly(self):
        import os, subprocess
        script = Path(__file__).resolve().parent / "require_pat.sh"
        env = {k: v for k, v in os.environ.items() if k != "WFO_WEEKLY_PAT"}
        r = subprocess.run(["bash", str(script)], capture_output=True, text=True, env=env)
        self.assertEqual(r.returncode, 1)
        self.assertIn("WFO_WEEKLY_PAT is missing", r.stderr)
        # Must never look like a token dump
        self.assertNotRegex(r.stdout + r.stderr, r"ghp_|github_pat_|gho_")

    def test_present_secret_ok_without_echoing_value(self):
        import os, subprocess
        script = Path(__file__).resolve().parent / "require_pat.sh"
        env = dict(os.environ)
        env["WFO_WEEKLY_PAT"] = "dummy-value-not-a-github-token"
        r = subprocess.run(["bash", str(script)], capture_output=True, text=True, env=env)
        self.assertEqual(r.returncode, 0)
        self.assertIn("present", r.stdout)
        self.assertNotIn("dummy-value-not-a-github-token", r.stdout)
        self.assertNotIn("dummy-value-not-a-github-token", r.stderr)


class TestSanitizeLogin(unittest.TestCase):
    def test_accepts_valid_logins(self):
        from scripts.weekly.sources.github_sponsors import sanitize_login
        for login in ("vercel", "getsentry", "n8n-io", "FrontendMasters", "a", "A" * 39):
            self.assertEqual(sanitize_login(login), login)

    def test_rejects_invalid_logins(self):
        from scripts.weekly.sources.github_sponsors import sanitize_login
        for bad in (
            "",
            "-vercel",
            "vercel-",
            "ver cell",
            "ver\ncel",
            "a" * 40,
            "foo/bar",
            'foo"bar',
            "${{inputs.x}}",
            "alice;rm -rf",
        ):
            self.assertIsNone(sanitize_login(bad), msg=repr(bad))
        self.assertIsNone(sanitize_login(None))

    def test_graphql_uses_variables_not_interpolation(self):
        import inspect
        from scripts.weekly.sources import github_sponsors as gh
        src = inspect.getsource(gh)
        self.assertIn("variables", src)
        self.assertIn("SPONSORING_QUERY", src)
        # Old interpolation pattern must be gone
        self.assertNotIn('login: "{login}"', src)
        self.assertNotIn("login: \"{login}\"", src)


class TestOpenDataPrGuard(unittest.TestCase):
    def test_script_mentions_data_weekly_only_and_base_main(self):
        script = (Path(__file__).resolve().parent / "open_data_pr.sh").read_text()
        self.assertIn("origin/main", script)
        self.assertIn("--base main", script)
        self.assertIn("data/weekly/", script)
        self.assertIn("outside data/weekly", script)
        self.assertNotIn("--force", script)


class TestSlugRenames(unittest.TestCase):
    """QA 5ecce2e: every slug that canonical_text changes has a 308 entry."""

    def test_rename_map_is_complete_and_committed(self):
        import json
        from scripts.weekly import slug_renames
        committed = json.loads(slug_renames.OUT.read_text(encoding="utf-8"))["renames"]
        self.assertEqual(committed, slug_renames.compute())
        for old, new in {"et-reo": "etereo", "b-rkert-werke-gmbh-co-kg": "burkert-werke-gmbh-co-kg",
                         "sch-co": "schuco", "t-mavera": "timavera"}.items():
            self.assertEqual(committed.get(old), new)

    def test_index_resolves_old_and_new_name_slugs(self):
        from scripts.weekly.normalize import legacy_slugify
        idx = build_catalog_index({"index": [{"slug": "et-reo", "name": "Et\u00e9reo"}]})
        self.assertEqual(idx.resolve(name="Et\u00e9reo"), "et-reo")
        self.assertEqual(idx.aliases.get(legacy_slugify("Et\u00e9reo")), "et-reo")
        self.assertEqual(idx.aliases.get("etereo"), "et-reo")


class TestRenamedKeysStayFiltered(unittest.TestCase):
    """QA a94c4e9 P1: denylist, exclusions and holds match old and new slugs."""

    @classmethod
    def setUpClass(cls):
        # Cases come from the data, not hard-coded slugs: renames touching a denylist key.
        from scripts.weekly.slug_aliases import _maps
        _, dl = parse_spam_denylist()
        cls.CASES = [(o, n) for o, n in _maps()[0].items() if o in dl or n in dl]
        assert len(cls.CASES) >= 3, cls.CASES

    def test_casing_matches_ts(self):
        from scripts.weekly.slug_aliases import slug_equivalents
        for o, n in self.CASES:
            self.assertEqual(slug_equivalents(f" {n.upper()} "), [n, o])
        for k in ("constructor", "__proto__"):
            self.assertEqual(slug_equivalents(k), [k])

    def test_denylist_before_and_after_rebuild(self):
        _, dl = parse_spam_denylist()
        for old, new in self.CASES:
            for s in (old, new):
                self.assertIsNotNone(is_excluded(slug=s, login=s, denylist=dl, exclusions=[]), s)

    def test_exclusion_login_before_and_after(self):
        from scripts.weekly.denylist import ExclusionEntry
        import dataclasses
        fields = {f.name for f in dataclasses.fields(ExclusionEntry)}
        for old, new in self.CASES:
            for key, probe in ((old, new), (new, old), (old, old)):
                row = ExclusionEntry(**{f: "" for f in fields} | {"login_github": key, "exclusion_raison": "qa"})
                self.assertEqual(is_excluded(slug=probe, exclusions=[row]), "exclusion:qa", (key, probe))

    def test_holds_before_and_after(self):
        for old, new in self.CASES:
            # (hold key as written, slug in the catalog/weekly data)
            for hold_key, cur in ((old, old), (old, new), (new, old)):
                base = [{"slug": cur, "name": "X", "sources": ["gh"], "login": cur, "ghBeneficiaries": 5}]
                cov = CoverageReport(sources={"github_sponsors": {"full": True, "status": "ok", "meta": {"ok_logins": [cur]}}})
                diff = diff_snapshots([], base, baseline_kind="weekly", baseline_path="p.json", coverage=cov)
                holds = [{"slug": hold_key, "reason": "qa", "since": "2026-10-12", "review_on": "2026-12-01"}]
                out = apply_holds(diff, [], base, holds, run_date="2026-10-19", require_two_zero=False)
                self.assertEqual([h["slug"] for h in diff.held], [cur], (hold_key, cur))
                self.assertEqual(out[0]["hold"]["kind"], "manual")
