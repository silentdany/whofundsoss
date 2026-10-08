import { createFileRoute, Link } from "@tanstack/react-router";
import { PageIntro, Shell } from "@/components/shell";
import { money } from "@/lib/format";
import { loadMysteries } from "@/lib/queries";
import { pageHead } from "@/lib/seo";
import { PAGE_TITLES } from "@/lib/site";

export const Route = createFileRoute("/mysteries")({
  loader: () => loadMysteries(),
  head: () =>
    pageHead({
      path: "/mysteries",
      title: PAGE_TITLES.mysteries,
      description: "Companies that publish open source pledge dollars but name no projects, and GitHub sponsors with no public tier amount. What is public and what is not.",
    }),
  component: MysteriesPage,
});

function MysteriesPage() {
  const { meta, unitemized, unpriced } = Route.useLoaderData();

  return (
    <Shell collectedAt={meta.collectedAt} hash={meta.hash}>
      <PageIntro
        eyebrow="Mysteries · inconsistencies, not accusations"
        title="Numbers that don't add up yet."
        lede="Some companies publish a dollar figure but name no project. Others name many maintainers they sponsor but never publish what they pay. Both can be perfectly legitimate. We flag the gap and never fill it in."
      />
      <section className="mx-auto max-w-[1120px] px-5 pb-10">
        <h2 className="font-serif text-2xl">Money declared, no project named</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">
          One reading: the pledge is real and the project list was never published. Another: the figure
          is a general commitment by the organization. The public record cannot tell them apart.
        </p>
        {unitemized.length ? (
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {unitemized.map((row) => (
              <MysteryRow key={row.slug} slug={row.slug} name={row.name}>
                {row.rank ? <span className="text-muted">Rank {row.rank} · </span> : null}
                <span className="font-semibold text-ink tabular-nums">{money(row.publicUsd)}</span>
              </MysteryRow>
            ))}
          </ul>
        ) : (
          <p className="mt-6 rounded-card bg-sand px-5 py-4 text-secondary">
            Nothing to flag here in this snapshot. Every company that declares dollars also names at least
            one project.
          </p>
        )}
      </section>
      <section className="mx-auto max-w-[1120px] px-5 pt-6 pb-16">
        <h2 className="font-serif text-2xl">Maintainers named, price hidden</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">
          These companies sponsor eight or more maintainers on GitHub, yet no sponsorship tier shows an
          amount. The relationship is public; the price is not. We never turn a monthly figure into a year.
        </p>
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {unpriced.map((row) => (
            <MysteryRow key={row.slug} slug={row.slug} name={row.name}>
              <span className="tabular-nums">
                {row.ghBeneficiaries} maintainers sponsored ·{" "}
                {row.publicUsd > 0 ? `${money(row.publicUsd)} public elsewhere` : "amount not public"}
              </span>
            </MysteryRow>
          ))}
        </ul>
      </section>
    </Shell>
  );
}

function MysteryRow({ slug, name, children }: { slug: string; name: string; children: React.ReactNode }) {
  return (
    <li className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-4 transition-colors hover:bg-sand/60">
      <Link to="/company/$slug" params={{ slug }} className="font-medium after:absolute after:inset-0">
        {name}
      </Link>
      <span className="text-sm text-secondary">{children}</span>
    </li>
  );
}
