# SEO notes (P0: rename + technical SEO)

Stack: TanStack Start + Vite + Nitro (`preset: vercel`). Pack: `SEO-PACK-2026-10-06.md`, Phases 1–4.

## Env
- `SITE_URL` (build-time, inlined by `vite.config.ts` `define`). Fallback `https://whofundsoss.vercel.app`.
  Used by canonical, `og:url`, `og:image`, sitemap, robots `Sitemap:` and JSON-LD (`src/lib/site.ts`).
  When the custom domain is live: set `SITE_URL=https://whofundsoss.com` in Vercel (Production) and redeploy.
- `VERCEL_ENV` (runtime, Vercel system env). Not `production` ⇒ `robots.txt` = `Disallow: /` and
  `X-Robots-Tag: noindex` on every SSR/server-route response (`src/start.ts`).

## Redirects (308, single hop, `src/lib/redirects.ts` + `src/start.ts`)
| From | To |
|---|---|
| `/classement` | `/ranking` |
| `/methode` | `/method` |
| `/mouvements` | `/movements` |
| `/mysteres` | `/mysteries` |
| `/graphe` | `/graph` |
| host `whofundsoss.vercel.app` (only when `SITE_URL` is another host) | `SITE_URL` + same (new) path |
| host `www.<SITE_URL host>` | `SITE_URL` + same (new) path |

Trailing slash and case are normalized; query strings are kept. Preview hosts are never redirected.

## Metadata
- `src/lib/seo.ts` `pageHead()` builds title, description, robots, canonical, og:*, twitter:*, JSON-LD per route.
- Title template `%s · WhoFundsOSS` (no em dash). Home: `WhoFundsOSS · Who really funds open source`.
- JSON-LD: Organization + WebSite on every page (root); Dataset on `/` and `/method`; BreadcrumbList on `/company/*`.
  No FAQPage / Review / AggregateRating / Product.
- 404 (global and unknown company): `Page not found · WhoFundsOSS`, `noindex`, HTTP 404.
- Platform head injector (`scripts/grok-pwa-shared.mjs`) used to overwrite every og:/twitter: tag.
  `src/lib/og/site.json` now sets `appShareMeta: true`, so the app's own per-route share tags are kept.
  The injector also no longer adds a second manifest / apple-touch-icon when the app links its own.

## Indexing gate (`/company/[slug]`)
`index,follow` if the slug is NOT in the spam denylist AND (public USD > 0 OR ≥ 3 distinct named projects;
aggregate pledge lines do not count); otherwise `noindex,follow` and excluded from `sitemap.xml`
(`src/lib/indexing.ts`, tested in `src/lib/indexing.test.ts`).

Spam denylist: `src/lib/spam-denylist.ts`, explicit slugs with category + reason, versioned
(`SPAM_DENYLIST_VERSION`). No heuristic. Denylisted companies stay in the data and in the ranking;
only their page is `noindex,follow` and absent from the sitemap. Edit the file in a PR to add or remove one. Sitemap = 7 static pages + gated companies,
`lastmod` = catalog `collectedAt`.

## Check
```bash
npm run build && npm run preview:restart
npm run seo:check -- http://127.0.0.1:8081
# protected Vercel preview:
SEO_CHECK_HEADERS='{"x-vercel-protection-bypass":"<secret>"}' npm run seo:check -- https://<preview>
```
Fails on: missing/duplicate/>70-char title, missing/duplicate description, canonical ≠ sitemap loc,
og:image not 200 image/* < 300 KB, ≠ 1 `<h1>`, noindex URL in sitemap, em dash in title.
Warns on: title 61–70 chars, description outside 120–160.

## Deferred (P1)
Dynamic OG per company, `/project/*` (Phase 5), spokes (Phase 6).
