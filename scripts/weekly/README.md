# Weekly scraper

Ports the research collectors (`github_sponsors/collect.py`, `build_publishable.py` rules)
into the public repo. No `/workspace` dependency at runtime.

```bash
# Unit tests (no network)
python3 -m unittest scripts.weekly.test_weekly -v

# Local run (uses `gh auth` / GH_TOKEN / GH_SPONSORS_TOKEN — never echo)
python3 -m scripts.weekly.run
python3 -m scripts.weekly.run --gh-logins vercel,getsentry --max-oc 20 --max-osp 5
```

Sources:

1. **GitHub Sponsors** — GraphQL `organization|user.sponsoring` (public lists; amounts almost never public → left `null`, never invented)
2. **Open Collective** — `opencollective.com/{slug}/members/organizations.json`
3. **Open Source Pledge** — scrape `opensourcepledge.com/members/` + member pages

Denylist: parse `src/lib/spam-denylist.ts` (single source of truth).
Exclusions: `data/exclusions/raw-exclusions.csv` (120 rows = 119 spam + supabase_self_fund).
Suspects: keyword flag only — never exclude.

Workflow: `scripts/weekly/github-workflow.yml` (copy to `.github/workflows/weekly-scraper.yml` once the `workflow` OAuth scope is available) (cron `17 4 * * 1` + `workflow_dispatch`).
