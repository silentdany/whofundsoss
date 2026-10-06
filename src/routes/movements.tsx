import { createFileRoute, Link } from "@tanstack/react-router";
import { PageIntro, Shell } from "@/components/shell";
import { collectedLabel } from "@/lib/format";
import { loadMovements } from "@/lib/queries";
import { pageHead } from "@/lib/seo";
import { formatTitle } from "@/lib/site";

export const Route = createFileRoute("/movements")({
  loader: () => loadMovements(),
  head: () =>
    pageHead({
      path: "/movements",
      title: formatTitle("Open source funding changes this month"),
      description: "Which companies started, raised or stopped funding open source since the last monthly snapshot. Public sources only, no forecasts.",
    }),
  component: MovementsPage,
});

function MovementsPage() {
  const { meta, note } = Route.useLoaderData();

  return (
    <Shell collectedAt={meta.collectedAt} hash={meta.hash}>
      <PageIntro
        eyebrow={`Collected ${collectedLabel(meta.collectedAt)}`}
        title="Nothing moved. This is the floor."
        lede={note}
      />
      <section className="mx-auto max-w-[1120px] px-5 pb-16">
        <div className="max-w-2xl space-y-6 text-lg leading-relaxed text-secondary">
          <p>
            The next full collection is scheduled for the first of the month. That run writes a second
            snapshot. This page then compares rank, public dollars, and project counts.
          </p>
          <p>
            A rank that moves by more than five places is a notable move. Rises will be marked in green,
            falls in rust. Until a second file exists, those colors stay unused. A wrong forecast would
            be worse than an empty month.
          </p>
        </div>
        <dl className="mt-12 grid gap-8 border-t border-line pt-8 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted">Risers</dt>
            <dd className="mt-2 font-serif text-4xl tabular-nums">0</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Fallers</dt>
            <dd className="mt-2 font-serif text-4xl tabular-nums">0</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Entrants / exits</dt>
            <dd className="mt-2 font-serif text-4xl tabular-nums">0</dd>
          </div>
        </dl>
        <p className="mt-10 text-sm text-secondary">
          Structural oddities from this single file live on{" "}
          <Link to="/mysteries" className="text-sage">
            Mysteries
          </Link>
          . They are not movements.
        </p>
      </section>
    </Shell>
  );
}
