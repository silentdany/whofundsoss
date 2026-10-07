import { createFileRoute, Link } from "@tanstack/react-router";
import { PageIntro, Shell } from "@/components/shell";
import { Delta } from "@/components/ui";
import { isSpamDenylisted } from "@/lib/spam-denylist";
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
  const { meta, from, to, summary, note, newCompanies, leftCompanies, newTop200, leftTop200 } = data;

  // Spam-denylisted pages stay in the data, but we never feature them in a "what moved" story.
  const clean = (rows: MovementCompany[]) => rows.filter((row) => !isSpamDenylisted(row.slug));
  const climbers = clean(data.climbers);
  const bigClimbers = climbers.filter((row) => row.deltaUsd >= 10);
  const smallClimbers = climbers.filter((row) => row.deltaUsd < 10);
  const hidden = data.climbers.length - climbers.length + (newCompanies.length - clean(newCompanies).length);
  const fresh = clean(newCompanies);
  const quiet = [
    leftCompanies.length === 0 && "no company left the catalog",
    newTop200.length === 0 && leftTop200.length === 0 && "the top 200 did not change",
    data.unchangedLeaders.length >= 10 && "the top 10 kept the same order",
  ].filter(Boolean) as string[];

  const headline =
    summary.deltaUsd === 0
      ? "Nothing moved in public dollars."
      : `${signedMoney(summary.deltaUsd)} in public funding, ${signedInt(summary.deltaCompanies)} ${
          Math.abs(summary.deltaCompanies) === 1 ? "company" : "companies"
        } tracked.`;

  return (
    <Shell collectedAt={meta.collectedAt} hash={meta.hash}>
      <PageIntro
        eyebrow={`${collectedLabel(from.collectedAt)} to ${collectedLabel(to.collectedAt)}`}
        title="What changed since the last snapshot."
        lede={`${headline} We compare two monthly readings of the public record. Small gaps between them are normal: it is a floor that only moves when someone publishes something new.`}
      />
      <section className="mx-auto max-w-[1120px] px-5 pb-16">
        <dl className="grid grid-cols-2 gap-6 border-t border-line pt-8 lg:grid-cols-4">
          <Stat label="Public dollars" value={signedMoney(summary.deltaUsd)} delta={summary.deltaUsd} />
          <Stat label="Companies tracked" value={signedInt(summary.deltaCompanies)} delta={summary.deltaCompanies} />
          <Stat label="Companies that gained" value={String(climbers.length)} />
          <Stat label="New · gone" value={`${fresh.length} · ${leftCompanies.length}`} />
        </dl>

        <MoveSection
          title="Biggest gains"
          empty="No company gained $10 or more in public dollars."
          rows={bigClimbers}
          mode="delta"
        />
        {smallClimbers.length ? (
          <details className="mt-4 rounded-card bg-sand px-5 py-4">
            <summary className="min-h-8 cursor-pointer text-sm font-medium">
              {smallClimbers.length} smaller {smallClimbers.length === 1 ? "change" : "changes"} (under $10)
            </summary>
            <ul className="mt-3 divide-y divide-line">
              {smallClimbers.map((row) => (
                <MoveRow key={row.slug} row={row} mode="delta" />
              ))}
            </ul>
          </details>
        ) : null}
        {fresh.length ? <MoveSection title="New this month" empty="" rows={fresh} mode="enter" /> : null}
        {leftCompanies.length ? (
          <MoveSection title="No longer in the catalog" empty="" rows={leftCompanies} mode="exit" />
        ) : null}
        {newTop200.length ? <MoveSection title="Entered the top 200" empty="" rows={newTop200} mode="rank" /> : null}
        {leftTop200.length ? <MoveSection title="Left the top 200" empty="" rows={leftTop200} mode="rank" /> : null}

        {quiet.length ? (
          <p className="mt-12 rounded-card border border-line px-5 py-4 text-secondary">
            <span className="font-medium text-ink">Also: </span>
            {quiet.join(", ")}.
          </p>
        ) : null}

        <details className="mt-10 text-sm text-secondary">
          <summary className="min-h-8 cursor-pointer font-medium text-ink">How this comparison was built</summary>
          <p className="mt-3 max-w-2xl leading-relaxed">
            {note} Snapshot fingerprints, for anyone who wants to verify: {from.collectedAt}{" "}
            <span className="tabular-nums">{hashShort(from.hash)}</span> to {to.collectedAt}{" "}
            <span className="tabular-nums">{hashShort(to.hash)}</span>.
            {hidden > 0
              ? ` ${hidden} entr${hidden === 1 ? "y" : "ies"} from the spam denylist ${hidden === 1 ? "is" : "are"} left out of these lists.`
              : ""}
          </p>
        </details>

        <p className="mt-8 text-sm text-secondary">
          Looking for numbers that don't add up inside a single snapshot? See{" "}
          <Link to="/mysteries" className="font-medium text-sage">
            Mysteries
          </Link>
          .
        </p>
      </section>
    </Shell>
  );
}

function Stat({ label, value, delta }: { label: string; value: string; delta?: number }) {
  const tone = delta == null ? "text-ink" : delta > 0 ? "text-rise" : delta < 0 ? "text-fall" : "text-ink";
  return (
    <div className="flex flex-col-reverse justify-end">
      <dt className="mt-1 text-sm text-secondary">{label}</dt>
      <dd className={`font-serif text-4xl tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}

type Mode = "delta" | "enter" | "exit" | "rank" | "leader";

function MoveSection({
  title,
  empty,
  rows,
  mode,
}: {
  title: string;
  empty: string;
  rows: MovementCompany[];
  mode: Mode;
}) {
  return (
    <div className="mt-12">
      <h2 className="font-serif text-2xl text-ink">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-secondary">{empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {rows.slice(0, 25).map((row) => (
            <MoveRow key={row.slug} row={row} mode={mode} />
          ))}
        </ul>
      )}
    </div>
  );
}

function MoveRow({ row, mode }: { row: MovementCompany; mode: Mode }) {
  return (
    <li className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3.5 transition-colors hover:bg-sand/60">
      <Link
        to="/company/$slug"
        params={{ slug: row.slug }}
        className="font-medium text-ink after:absolute after:inset-0"
      >
        {row.name}
      </Link>
      <span className="flex items-center gap-3 text-sm text-secondary tabular-nums">
        {rowDetail(row, mode)}
        {mode === "delta" ? <Delta value={row.deltaUsd}>{signedMoney(row.deltaUsd)}</Delta> : null}
      </span>
    </li>
  );
}

function rowDetail(row: MovementCompany, mode: Mode): string {
  if (mode === "delta") {
    return row.deltaRank != null && row.deltaRank !== 0
      ? `rank ${row.previousRank} → ${row.rank}`
      : row.rank != null
        ? `rank ${row.rank}`
        : "";
  }
  return formatRow(row, mode);
}

function formatRow(row: MovementCompany, mode: Mode): string {
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
