# Weekly scrape snapshots

Produced by `scripts/weekly/run.py` (GitHub Actions workflow `weekly-scraper.yml`).

Each run writes:

- `YYYY-MM-DD.json` — machine-readable snapshot + diff + suspects
- `YYYY-MM-DD.md` — human-readable report for the data PR

The workflow uploads both as a run artifact and opens a **data PR**. Never push straight to `main`; never auto-merge.

Spam denylist source of truth: `src/lib/spam-denylist.ts` (parsed, not copied).
Raw exclusions: `data/exclusions/raw-exclusions.csv` (131 rows (spam + platform_pass_through + self-fund; see data/exclusions/README.md) from the 2026-10-05 publishable build).
