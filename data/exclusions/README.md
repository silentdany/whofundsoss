# Raw exclusions

`raw-exclusions.csv` — **131** companies excluded from publishable / weekly actionable lists:

| Reason | Meaning |
|---|---|
| `spam_casino` | Gambling / casino / betting SEO affiliates |
| `spam_vpn` | VPN promo spam |
| `spam_followers` | Fake followers / likes / views sellers |
| `spam_seo` | Link-building / essay-mill / SEO spam |
| `supabase_self_fund` | Self-fund programme (not third-party OSS funding) |
| `platform_pass_through` | Platforms or fiscal hosts (GitHub Sponsors, Open Collective / OSC / OCF) — not company funders |

Counts (2026-10-06 triage): 90 spam_casino + 28 spam_followers + 4 spam_vpn + 4 spam_seo + 1 supabase_self_fund + 4 platform_pass_through = **131**.

Ported from the research tree into the public repo so the weekly scraper does not
depend on `/workspace`. The SEO spam denylist in `src/lib/spam-denylist.ts` is a
separate, explicit, versioned list used for `noindex` / sitemap omission; both
are applied by the weekly scraper for annotation.
