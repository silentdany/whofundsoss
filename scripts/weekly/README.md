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
