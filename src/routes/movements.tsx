import { createFileRoute, Link } from "@tanstack/react-router";
import { PageIntro, Shell } from "@/components/shell";
import { collectedLabel, money } from "@/lib/format";
import { loadMovements } from "@/lib/queries";
import { pageHead } from "@/lib/seo";
import { PAGE_TITLES } from "@/lib/site";
import type { MovementCompany } from "@/lib/types";

export const Route = createFileRoute("/movements")({
  loader: () => loadMovements(),
  head: () =>
    pageHead({
      path: "/movements",
      title: PAGE_TITLES.movements,
      description:
        "Which companies started, raised or stopped funding open source since the last public snapshot. Public sources only, no forecasts.",
    }),
  component: MovementsPage,
});

function MovementsPage() {
  const data = Route.useLoaderData();
  const { meta, from, to, summary, note, climbers, newCompanies, leftCompanies, newTop200, leftTop200, unchangedLeaders } =
    data;

  return (
    <Shell collectedAt={meta.collectedAt} hash={meta.hash}>
      <PageIntro
        eyebrow={`${collectedLabel(from.collectedAt)} → ${collectedLabel(to.collectedAt)}`}
        title="What moved between snapshots"
        lede={note}
      />
      <section className="mx-auto max-w-[1120px] px-5 pb-16">
        <dl className="grid gap-8 border-t border-line pt-8 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Δ public $" value={signedMoney(summary.deltaUsd)} />
          <Stat label="Δ companies" value={signedInt(summary.deltaCompanies)} />
          <Stat label="Climbers (|Δ| ≥ $1)" value={String(summary.climbers)} />
          <Stat label="New / left catalog" value={`${summary.newCompanies} / ${summary.leftCompanies}`} />
        </dl>

        <p className="mt-8 text-sm text-secondary">
          Hashes:{" "}
          <code className="text-ink">
            {from.collectedAt} {hashShort(from.hash)}
          </code>
          {" → "}
          <code className="text-ink">
            {to.collectedAt} {hashShort(to.hash)}
          </code>
          . Weekly scraper JSON is not read here.
        </p>

        <MoveSection
          title="Climbers"
          empty="No company gained at least $1 in public dollars."
          rows={climbers}
          mode="delta"
        />
        <MoveSection
          title="New companies"
          empty="No new publishable companies."
          rows={newCompanies}
          mode="enter"
        />
        <MoveSection
          title="Left the catalog"
          empty="No company left the publishable set."
          rows={leftCompanies}
          mode="exit"
        />
        <MoveSection
          title="New in top 200"
          empty="Top 200 membership did not change."
          rows={newTop200}
          mode="rank"
        />
        <MoveSection
          title="Left top 200"
          empty="Nobody dropped out of the top 200."
          rows={leftTop200}
          mode="rank"
        />
        <MoveSection
          title="Unchanged leaders (top 10, same rank)"
          empty="Every top-10 seat moved."
          rows={unchangedLeaders}
          mode="leader"
        />

        <p className="mt-10 text-sm text-secondary">
          Structural oddities from a single file still live on{" "}
          <Link to="/mysteries" className="text-sage">
            Mysteries
          </Link>
          . They are not movements.
        </p>
      </section>
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-2 font-serif text-4xl tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function MoveSection({
  title,
  empty,
  rows,
  mode,
}: {
  title: string;
  empty: string;
  rows: MovementCompany[];
  mode: "delta" | "enter" | "exit" | "rank" | "leader";
}) {
  return (
    <div className="mt-14">
      <h2 className="font-serif text-2xl text-ink">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-secondary">{empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {rows.slice(0, 25).map((row) => (
            <li key={row.slug} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
              <Link to="/company/$slug" params={{ slug: row.slug }} className="font-medium text-ink hover:text-sage">
                {row.name}
              </Link>
              <span className="text-sm tabular-nums text-secondary">{formatRow(row, mode)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatRow(row: MovementCompany, mode: "delta" | "enter" | "exit" | "rank" | "leader"): string {
  if (mode === "delta") {
    const rankBit =
      row.deltaRank != null && row.deltaRank !== 0
        ? ` · rank ${row.previousRank}→${row.rank} (${signedInt(row.deltaRank)})`
        : row.rank != null
          ? ` · rank ${row.rank}`
          : "";
    return `${signedMoney(row.deltaUsd)}${rankBit}`;
  }
  if (mode === "enter") return `${money(row.publicUsd)}${row.rank != null ? ` · rank ${row.rank}` : ""}`;
  if (mode === "exit") return `${money(row.previousPublicUsd ?? 0)} was public`;
  if (mode === "rank") {
    if (row.previousRank == null && row.rank != null) return `entered at ${row.rank}`;
    if (row.rank == null && row.previousRank != null) return `was ${row.previousRank}`;
    return `rank ${row.previousRank}→${row.rank}`;
  }
  return `rank ${row.rank} · ${money(row.publicUsd)}`;
}

function signedMoney(n: number): string {
  const abs = money(Math.abs(n));
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${abs}`;
  return abs;
}

function signedInt(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return String(n);
}

function hashShort(hash: string): string {
  return hash.slice(0, 12);
}
