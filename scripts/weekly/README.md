# Weekly scraper

Ports the research collectors into the public repo. **Default = full catalog scope.**

```bash
# Unit tests (no network)
python3 -m unittest scripts.weekly.test_weekly -v

# Full weekly run (GH catalog sponsors + all OC collectives + all OSP members)
python3 -m scripts.weekly.run

# Smoke only (marks coverage partial → disappearances go to unverified)
python3 -m scripts.weekly.run --gh-logins vercel,getsentry --max-oc 20 --max-osp 5
```

## Diff semantics (WFOSS Data bot)

- **Slugs** resolve through `src/data/catalog.json` aliases (`getsentry` ← OSP `sentry`, name kebab-case, site host…).
- **Retention** matches the catalog build: keep if `gh`/`osp`/`own`, or OC with ≥3 collectives or ≥$5k public.
- **Disappeared** only when every source covering that baseline company ran with **full** coverage; otherwise → `unverified_partial`.
- **Amount changes** are like-with-like (`oc↔oc`, `osp↔osp`, `own↔own`).
- If new or disappeared > 10% of baseline → `suspicious: true` + ⚠ banner in the `.md` (run still succeeds).

## Sources

1. **GitHub Sponsors** — GraphQL `sponsoring` for every catalog company with `gh` + seed orgs
2. **Open Collective** — all collectives in `OC_COLLECTIVES` (~104)
3. **Open Source Pledge** — full members index

Denylist source of truth: `src/lib/spam-denylist.ts` (parsed).
Exclusions: `data/exclusions/raw-exclusions.csv`.
Workflow: `.github/workflows/weekly-scraper.yml` (cron `17 4 * * 1` + `workflow_dispatch`).

## Identity, disappearances and duplicate runs (2026-10-12)

- **Stable Open Collective identity.** Each company records `ocAccounts` (the OC account slug from the member profile, which does not change when our slug does). The diff matches a baseline row and a current row with the same `ocAccounts`, GitHub login or OSP slug as one entity and lists it under `renamed` instead of one disappearance plus one new sponsor. Baselines written before `ocAccounts` existed fall back to an exact match on site domain plus name, for OC-only rows (cases `unknown` → `sxl-cn`, `unknown-x` → `duotai-net`).
- **Two zero readings before a disappearance.** A verified disappearance is first moved to `held` and the last known record is carried forward with `hold.kind = "zero_reading"`. It is published only if the next run also reads zero. Manual holds in `data/holds/weekly-holds.csv` still apply on top.
- **Homoglyphs.** Before the denylist name match and the suspect regexes, Cyrillic and Greek lookalike letters inside mixed-script words are folded to Latin (`Сoinsmania` with a Cyrillic С reads as `Coinsmania`). Native-script words such as `казино` are left as they are.
- **One data PR per date.** The workflow skips the scrape when an open or merged data PR already touches `data/weekly/<date>.json` (a closed, unmerged PR does not count). Use the `force` dispatch input to re-run anyway. The workflow part ships as `docs/weekly-scraper-dedupe.patch` until it is applied with a token that has the `workflow` scope (`git apply docs/weekly-scraper-dedupe.patch`).
