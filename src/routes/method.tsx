import { createFileRoute } from "@tanstack/react-router";
import { PageIntro, Shell } from "@/components/shell";
import { collectedLabel, hashShort, money } from "@/lib/format";
import { loadMethod } from "@/lib/queries";
import { datasetJsonLd, pageHead } from "@/lib/seo";
import { formatTitle } from "@/lib/site";

export const Route = createFileRoute("/method")({
  loader: () => loadMethod(),
  head: ({ loaderData }) =>
    pageHead({
      path: "/method",
      title: formatTitle("Method: how we count open source funding"),
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
        lede="Known public total, per company, is the sum of amounts that were already public. Nothing is annualized. Nothing private is inferred. The same pledge dollar is not counted twice."
      />
      <article className="mx-auto max-w-[720px] space-y-10 px-5 pb-20 text-base leading-relaxed text-secondary">
        <section>
          <h2 className="font-serif text-2xl text-ink">The four sources</h2>
          <ul className="mt-4 space-y-3">
            <li>
              Open Collective — historical <span className="text-ink">totalAmountDonated</span>, often
              multi-year. Not a run-rate.
            </li>
            <li>Open Source Pledge — annual payment from the latest public report, devs times dollars per dev.</li>
            <li>GitHub Sponsors — a monthly amount only when the tier is public. That is rare. It is not multiplied by twelve.</li>
            <li>Own programs — a figure from a public page, or a name with no figure.</li>
          </ul>
        </section>
        <section>
          <h2 className="font-serif text-2xl text-ink">What was left out</h2>
          <p className="mt-4">
            Before this file: {ex.spamCompanies} spam companies ({money(ex.spamUsd)}) and{" "}
            {ex.selfFundCompanies} self-fund (Supabase, {money(ex.selfFundUsd)}). {ex.note}
          </p>
          <p className="mt-3">
            Supabase appears as a backer of its own collective. That was read as money moving through
            the project, not as classic outbound sponsoring, and kept out of the ranking until a manual
            review says otherwise.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl text-ink">Transparency, in one sentence</h2>
          <p className="mt-4">
            Score = 0.6 × (public dollars ÷ the leader) + 0.4 × (sponsorships with a public amount ÷
            sponsorships). The leader this collection is {money(meta.maxPublicUsd)}. A high score on a
            small total is labeled low volume. The score is never shown alone.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl text-ink">Snapshots</h2>
          <p className="mt-4">
            This build holds one snapshot, {collectedLabel(meta.collectedAt)}, hash {hashShort(meta.hash)}.{" "}
            {meta.companies} companies, {meta.sponsorships.toLocaleString("en-US")} sponsorship lines,{" "}
            {money(meta.publicUsdRanked)} in the top {meta.ranked}. {meta.cron}. Deltas compare two
            hashes. They do not forecast the next one.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl text-ink">Internal API</h2>
          <p className="mt-4">
            Read-only. Preview key, header <code className="text-ink">X-API-Key: wfo_preview_floor</code>.
            Health is open. The rest refuse a missing key.
          </p>
          <ul className="mt-4 space-y-1 text-sm text-ink">
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
        </section>
      </article>
    </Shell>
  );
}
