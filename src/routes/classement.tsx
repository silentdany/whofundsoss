import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageIntro, Shell } from "@/components/shell";
import { RankTable } from "@/components/rank-table";
import { collectedLabel } from "@/lib/format";
import { loadClassement } from "@/lib/queries";
import { SOURCE_SHORT, type SourceKey } from "@/lib/types";

export const Route = createFileRoute("/classement")({
  loader: () => loadClassement(),
  component: ClassementPage,
});

type SortKey = "publicUsd" | "projects" | "ghBeneficiaries";

function ClassementPage() {
  const { meta, rows } = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("publicUsd");
  const [source, setSource] = useState<SourceKey | "all">("all");
  const [whales, setWhales] = useState(true);
  const [scope, setScope] = useState<"ranked" | "all">("ranked");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let next = rows.filter((row) => (scope === "ranked" ? row.rank != null : true));
    if (!whales) next = next.filter((row) => !row.whale);
    if (source !== "all") next = next.filter((row) => row.sources.includes(source));
    if (q) next = next.filter((row) => row.name.toLowerCase().includes(q) || row.slug.includes(q));
    next = next.slice().sort((a, b) => {
      if (sort === "projects") return b.projects - a.projects || b.publicUsd - a.publicUsd;
      if (sort === "ghBeneficiaries") return b.ghBeneficiaries - a.ghBeneficiaries || b.publicUsd - a.publicUsd;
      return b.publicUsd - a.publicUsd;
    });
    return next;
  }, [rows, query, sort, source, whales, scope]);

  return (
    <Shell collectedAt={meta.collectedAt} hash={meta.hash}>
      <PageIntro
        eyebrow={`Collected ${collectedLabel(meta.collectedAt)}`}
        title="The public ranking."
        lede="Sorted by dollars that are already public. Rank is the dollar rank. Changing the sort does not invent a new one. Open Collective amounts are cumulative."
      />
      <div className="mx-auto max-w-[1120px] px-5 pb-4">
        <label className="block">
          <span className="sr-only">Search companies</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a company"
            className="w-full rounded-full border border-line bg-paper px-5 py-3 text-base outline-none focus:border-sage"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <FilterChip active={source === "all"} onClick={() => setSource("all")}>
            All sources
          </FilterChip>
          {(Object.keys(SOURCE_SHORT) as SourceKey[]).map((key) => (
            <FilterChip key={key} active={source === key} onClick={() => setSource(key)}>
              {SOURCE_SHORT[key]}
            </FilterChip>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <FilterChip active={sort === "publicUsd"} onClick={() => setSort("publicUsd")}>
            Public $
          </FilterChip>
          <FilterChip active={sort === "projects"} onClick={() => setSort("projects")}>
            Projects
          </FilterChip>
          <FilterChip active={sort === "ghBeneficiaries"} onClick={() => setSort("ghBeneficiaries")}>
            GitHub beneficiaries
          </FilterChip>
          <FilterChip active={!whales} onClick={() => setWhales((value) => !value)}>
            {whales ? "Hide $100k+" : "$100k+ hidden"}
          </FilterChip>
          <FilterChip active={scope === "all"} onClick={() => setScope((value) => (value === "all" ? "ranked" : "all"))}>
            {scope === "ranked" ? "Top 200" : "All in file"}
          </FilterChip>
        </div>
        <p className="mt-4 text-sm text-muted tabular-nums">{filtered.length} companies</p>
      </div>
      <div className="mx-auto max-w-[1120px] pb-16">
        <RankTable rows={filtered} />
      </div>
    </Shell>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "min-h-11 rounded-full bg-ink px-4 text-sm text-paper"
          : "min-h-11 rounded-full bg-sand px-4 text-sm text-ink"
      }
    >
      {children}
    </button>
  );
}
