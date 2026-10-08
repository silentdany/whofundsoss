# WhoFundsOSS

Public record of who funds open source. Amounts are a floor, read once a month.

Live at [whofundsoss.com](https://whofundsoss.com). How the numbers are counted: [whofundsoss.com/method](https://whofundsoss.com/method).

No ads, no paid placements. Nobody pays to appear in the ranking or to move up.

## Run it

```bash
npm install
npm run dev
```

Built with TanStack Start (ranking, movements, mysteries, graph, watchlist, method, API). API spec and design notes live in `docs/`.

SEO: see `SEO-NOTES.md` (env `SITE_URL`, redirects, indexing gate, `npm run seo:check`).

## Data

The shipped data is in `src/data/`: `catalog.json` for the live snapshot and `snapshots/` for the previous ones. Companies on the public spam denylist (`src/data/public-spam-denylist.json`) never get a rank; `scripts/data/apply-denylist.py` enforces that.

Corrections: open an issue with the company, the figure and a public link to its source.

## License

- Code: [MIT](LICENSE).
- Data (`src/data/`, `data/`, the exports and the API output): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit "WhoFundsOSS" with a link to whofundsoss.com. The underlying figures come from public pages of Open Collective, the Open Source Pledge, GitHub Sponsors and the companies themselves.
