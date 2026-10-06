# Raw exclusions

`raw-exclusions.csv` — 120 companies (119 spam + 1 supabase_self_fund) excluded from the 2026-10-05 publishable tops
(`spam_casino`, `spam_vpn`, `spam_followers`, `spam_seo`, plus `supabase_self_fund`).

Ported from the research tree into the public repo so the weekly scraper does not
depend on `/workspace`. The SEO spam denylist in `src/lib/spam-denylist.ts` is a
separate, explicit, versioned list used for `noindex` / sitemap omission; both
are applied by the weekly scraper for annotation.
