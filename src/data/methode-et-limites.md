# WhoFundsOSS — Method and limits

**Freshness:** 2026-10-05 (Europe/Paris)  
**Scope:** companies that fund open source via GitHub Sponsors, Open Collective, Open Source Pledge, or a documented own program.  
**Script:** `build_publishable.py` (reproducible).

## How rankings are built

1. **Raw base:** `/workspace/recherche/sponsor-apps-base-github-entreprises.csv` (963 companies) and `sponsor-apps-base-github.csv` (6566 sponsorships), collected 2026-10-05 (see `/workspace/recherche/sponsor-apps-base-github.md`).
2. **Known public total (USD)** = sum, per company, of amounts **already public** in the base:
   - Open Collective: `totalAmountDonated` (historical cumulative, often multi-year);
   - Open Source Pledge: annual payment from the latest public report (`devs × $/dev`);
   - GitHub Sponsors: monthly amount **only** when the tier is publicly exposed (rare);
   - Own programs: amounts announced on public pages.
3. **Top 50 by dollars:** non-excluded companies, sorted by `total_public_connu_usd` descending.
4. **Top 50 by GitHub beneficiaries:** same companies, sorted by `nb_beneficiaires_github` descending.
5. **Mid-market brands (audits):** Business Priority 1 — `(10,000 ≤ public $ < 100,000) OR (3 ≤ GH beneficiaries ≤ 12)`, **excluding** whales (`$ ≥ 100,000`), spam, and Supabase self-fund.

## What was filtered (exclusions)

| Reason | Companies | Public $ involved |
|---|---|---|
| `supabase_self_fund` | 1 | 1,097,800 |
| `spam_casino` | 85 | (included in spam below) |
| `spam_vpn` | 4 | |
| `spam_followers` | 28 | |
| `spam_seo` | 2 | |
| **Spam total** | **119** (12.4 %) | **643,728** |
| **Total excluded from tops** | **120** | — |

Excluded companies remain in `dump-public-entreprises.csv` / `dump-public-sponsorings.csv` with column `exclusion_raison`, and in `raw-exclusions.csv`. They are **absent** from the top 50 and from `marques-intermediaires-audit.*`.

### Supabase case

The `supabase` org appears as an active BACKER of the collective [opencollective.com/supabase](https://opencollective.com/supabase) with `totalAmountDonated = 1,097,800` (latest tx $150,000, Jan 2026). Research reading: funds flowing through the project's OC program, **not** classic outbound sponsoring. Flag `supabase_self_fund`; excluded from public rankings until manual review.

### Spam regex (rules)

Applied on `entreprise + login_github + site + secteur` (not on the `source` field):

- **spam_casino:** `casino|gambling|betting|poker|roulette|slots?|jackpot|stake|gambl|bingo|bookmaker|…`
- **spam_vpn:** `\bvpn\b|proxy.?service|nordvpn|expressvpn|surfshark|veepn|…`
- **spam_followers:** `buy.?followers|buy.?likes|buy.?views|twicsy|buzzoid|goread\.io|…`
- **spam_seo:** `seo.?service|link.?building|buy.?backlinks|buy.?youtube.?views|…`

Allowlist (never flagged): getsentry, stripe, vercel, github, microsoft, shopify, cloudflare, automattic, laravel, posthog, supabase, coderabbitai, sanity-io, muxinc, railway, get-convex.

Original Business scan: ≈ 130–140 entries, ≈ $0.64M (**rough estimate**). Here: **119** companies, **$643,728** — gap due to regex refinement on 2026-10-05; documented, not invented.

## Amount limits (shown on the site)

- **GitHub Sponsors:** monthly amounts are very often **not public**. The base shows *who* is funded, rarely *how much*. **No GH monthly amount is invented or annualized.**
- **Open Collective:** `totalAmountDonated` = **historical cumulative**, not a monthly run-rate. Old one-shot backers (`isActive=false`) remain in the detail dump.
- **Open Source Pledge:** **annual** amount from the latest public report (e.g. Sentry 132 × 5,682 = $750,000).
- The same OSP dollar is not double-counted via an "own program".
- **Private** GitHub sponsorships do not appear at all.
- Sector is unclassified for most companies; contact page known for a minority only (see raw base).

## Mid-market brand count

- Raw criteria with no filter: **189** (Business target ≈ 189).
- After spam + Supabase + whale exclusion (`$ ≥ 100k`): **172**.
- `segment_critere` split: {'dollars': 133, 'both': 6, 'beneficiaires': 33}.

Gap vs 189 = spam / self-fund / whale filtering, **not** a definition change.

## Regeneration

```bash
# 1) (optional) recollect
cd /workspace/recherche/github_sponsors && python3 -u collect.py   # long
python3 -u rebuild.py

# 2) rebuild publishable files
cd /workspace/recherche/whofundsoss && python3 -u build_publishable.py
```

Monthly collection (1st-of-month cron) should chain `rebuild` then `build_publishable.py`.
