import { createFileRoute, Link } from "@tanstack/react-router";
import { PageIntro, Shell } from "@/components/shell";
import { collectedLabel, hashShort, money } from "@/lib/format";
import { loadMethod } from "@/lib/queries";
import { datasetJsonLd, pageHead } from "@/lib/seo";
import { PAGE_TITLES } from "@/lib/site";
import { SPAM_DENYLIST_VERSION } from "@/lib/spam-denylist";

export const Route = createFileRoute("/method")({
  loader: () => loadMethod(),
  head: ({ loaderData }) =>
    pageHead({
      path: "/method",
      title: PAGE_TITLES.method,
      description:
        "How WhoFundsOSS counts public open source funding: sources, exclusions, no annualizing, hidden GitHub tiers stay hidden.",
      jsonLd: loaderData ? [datasetJsonLd(loaderData)] : [],
    }),
  component: MethodPage,
});

function MethodPage() {
  const meta = Route.useLoaderData();
  const ex = meta.exclusions;

  return (
    <Shell collectedAt={meta.collectedAt} hash={meta.hash}>
      <PageIntro
        eyebrow={`Freshness ${collectedLabel(meta.collectedAt)}`}
        title="How a number gets onto this site."
        lede="A company's public total is the sum of amounts it has already made public. Nothing is annualized, nothing private is inferred, and no dollar is counted twice."
      />
      <article className="mx-auto max-w-[720px] space-y-10 px-5 pb-20 text-base leading-relaxed text-secondary">
        <section>
          <h2 className="font-serif text-2xl text-ink">The four sources</h2>
          <ul className="mt-4 space-y-3">
            <li>
              <strong className="font-semibold text-ink">Open Collective:</strong> the total donated so far, often over several years. Not a yearly figure.
            </li>
            <li><strong className="font-semibold text-ink">Open Source Pledge:</strong> the yearly payment from the latest public report (developers times dollars per developer).</li>
            <li><strong className="font-semibold text-ink">GitHub Sponsors:</strong> a monthly amount, only when the tier is public. That is rare, and it is never multiplied by twelve.</li>
            <li><strong className="font-semibold text-ink">Own programs:</strong> a figure from the company's public page, or just the program's name when no figure is given.</li>
          </ul>
        </section>
        <section id="exclusions">
          <h2 className="font-serif text-2xl text-ink">What was left out</h2>
          <p className="mt-4">
            Before this file: {ex.spamCompanies} spam companies ({money(ex.spamUsd)}) and{" "}
            {ex.selfFundCompanies} self-fund (Supabase, {money(ex.selfFundUsd)}). {ex.note}
          </p>
          <p className="mt-3">
            Supabase appears as a backer of its own collective. We read that as money moving through its own
            project rather than outbound sponsoring, and keep it out of the ranking until a manual review
            says otherwise.
          </p>
          <p className="mt-3">
            A separate, versioned{" "}
            <Link to="/denylist" className="text-sage">
              public spam denylist
            </Link>{" "}
            (v{SPAM_DENYLIST_VERSION}) marks company pages with noindex,follow and drops them from
            sitemap.xml. Criteria, counts, and the entry list are public. Ranking dollars and company
            pages stay; nothing is invented by a heuristic. Machine copy:{" "}
            <a className="text-sage" href="/denylist.json">
              denylist.json
            </a>
            .
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl text-ink">The transparency score</h2>
          <p className="mt-4">
            Score = 0.6 × (public dollars ÷ the leader's dollars) + 0.4 × (sponsorships with a public amount ÷
            all sponsorships). The current leader is at {money(meta.maxPublicUsd)}. A high score on a
            small total is labeled "low volume". The score is never shown without the dollars next to it.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl text-ink">Snapshots</h2>
          <p className="mt-4">
            This build holds snapshot {collectedLabel(meta.collectedAt)}, hash {hashShort(meta.hash)}{meta.previousCollectedAt ? `, with prior ${collectedLabel(meta.previousCollectedAt)} (${hashShort(meta.previousHash ?? "")})` : ""}.{" "}
            {meta.companies} companies, {meta.sponsorships.toLocaleString("en-US")} sponsorship lines,{" "}
            {money(meta.publicUsdRanked)} in the top {meta.ranked}. Comparisons between two snapshots
            describe what changed. They never forecast what comes next.
          </p>
        </section>
        <details>
          <summary className="cursor-pointer font-serif text-2xl text-ink">For developers: internal API</summary>
          <p className="mt-4">
            Read-only. Preview key, sent as the header <code className="break-all text-ink">X-API-Key: wfo_preview_floor</code>.
            Health is open. The rest refuse a missing key.
          </p>
          <ul className="mt-4 space-y-2 text-sm break-all text-ink">
            <li>GET /api/health</li>
            <li>GET /api/v1/leaderboard?sort=public_usd|projects|gh&limit=50&offset=0&include_whales=false</li>
            <li>GET /api/v1/companies/:slug</li>
            <li>GET /api/v1/companies/:slug/sponsorships</li>
            <li>GET /api/v1/deltas?from=&to=</li>
            <li>GET /api/v1/graph/co-sponsorships?min_shared=2</li>
            <li>GET /api/v1/watchlist</li>
            <li>GET /api/v1/watchlist/alerts?since=</li>
            <li>GET /api/v1/export/companies</li>
            <li>GET /api/v1/export/sponsorships</li>
            <li>GET /api/v1/export/snapshots</li>
          </ul>
        </details>
      </article>
    </Shell>
  );
}
