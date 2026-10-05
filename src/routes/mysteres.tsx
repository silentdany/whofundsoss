import { createFileRoute, Link } from "@tanstack/react-router";
import { PageIntro, Shell } from "@/components/shell";
import { money } from "@/lib/format";
import { loadMysteries } from "@/lib/queries";

export const Route = createFileRoute("/mysteres")({
  loader: () => loadMysteries(),
  component: MysteriesPage,
});

function MysteriesPage() {
  const { meta, unitemized, unpriced } = Route.useLoaderData();

  return (
    <Shell collectedAt={meta.collectedAt} hash={meta.hash}>
      <PageIntro
        eyebrow="Inconsistencies, not accusations"
        title="Declared, not itemized."
        lede="Some companies publish a dollar figure and name no project. Others name many GitHub beneficiaries and publish no tier amount. Both can be true. Neither is filled in here."
      />
      <section className="mx-auto max-w-[1120px] px-5 pb-8">
        <h2 className="font-serif text-2xl">Pledge dollars, zero named projects</h2>
        <p className="mt-2 max-w-2xl text-sm text-secondary">
          A possible reading: the pledge is real and the project list was never itemized. Another:
          the figure is an organization-level promise. The file cannot tell them apart.
        </p>
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {unitemized.map((row) => (
            <li key={row.slug}>
              <Link
                to="/company/$slug"
                params={{ slug: row.slug }}
                className="flex items-baseline justify-between gap-4 py-4"
              >
                <span>
                  <span className="font-medium">{row.name}</span>
                  {row.rank ? <span className="ml-2 text-sm text-muted">Rank {row.rank}</span> : null}
                </span>
                <span className="tabular-nums">{money(row.publicUsd)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="mx-auto max-w-[1120px] px-5 pt-6 pb-16">
        <h2 className="font-serif text-2xl">Named on GitHub, amount not public</h2>
        <p className="mt-2 max-w-2xl text-sm text-secondary">
          Eight or more GitHub beneficiaries, and a GitHub total of zero. The relationship is public.
          The price is not. No monthly figure is turned into a year.
        </p>
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {unpriced.map((row) => (
            <li key={row.slug}>
              <Link
                to="/company/$slug"
                params={{ slug: row.slug }}
                className="flex items-baseline justify-between gap-4 py-4"
              >
                <span className="font-medium">{row.name}</span>
                <span className="text-sm text-secondary tabular-nums">
                  {row.ghBeneficiaries} beneficiaries · {money(row.publicUsd)} elsewhere
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Shell>
  );
}
