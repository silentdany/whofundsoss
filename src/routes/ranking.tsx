import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageIntro, Shell } from "@/components/shell";
import { RankTable } from "@/components/rank-table";
import { Chip, FilterGroup, Toggle } from "@/components/ui";
import { collectedLabel } from "@/lib/format";
import { loadRanking } from "@/lib/queries";
import { SOURCE_SHORT, type SourceKey } from "@/lib/types";
import { monthYear } from "@/lib/format";
import { pageHead } from "@/lib/seo";
import { PAGE_TITLES } from "@/lib/site";

export const Route = createFileRoute("/ranking")({
  loader: () => loadRanking(),
  head: ({ loaderData }) =>
    pageHead({
      path: "/ranking",
      title: PAGE_TITLES.ranking,
      description: loaderData
        ? `${loaderData.meta.ranked} companies ranked by publicly verifiable open source funding. Pledge, Open Collective and GitHub Sponsors, with sources. Updated ${monthYear(loaderData.meta.collectedAt)}.`
        : undefined,
    }),
  component: RankingPage,
});

type SortKey = "publicUsd" | "projects" | "ghBeneficiaries";

function RankingPage() {
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

  const filtersActive = query !== "" || source !== "all" || !whales || scope !== "ranked" || sort !== "publicUsd";
  const reset = () => {
    setQuery("");
    setSource("all");
    setWhales(true);
    setScope("ranked");
    setSort("publicUsd");
  };

  return (
    <Shell collectedAt={meta.collectedAt} hash={meta.hash}>
      <PageIntro
        eyebrow={`Data collected ${collectedLabel(meta.collectedAt)}`}
        title="The public ranking."
        lede="Companies sorted by the dollars they have publicly put into open source. The rank always follows the dollars, whichever sort you pick. Open Collective amounts are cumulative, not yearly."
      />
      <div className="mx-auto max-w-[1120px] px-5 pb-4">
        <label className="block">
          <span className="sr-only">Search companies</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by company name"
            className="min-h-14 w-full rounded-full border border-line bg-paper px-6 text-base shadow-sm outline-none focus:border-sage"
          />
        </label>
        <div className="mt-5 space-y-4">
          <FilterGroup label="Source">
            <Chip active={source === "all"} onClick={() => setSource("all")}>
              All
            </Chip>
            {(Object.keys(SOURCE_SHORT) as SourceKey[]).map((key) => (
              <Chip key={key} active={source === key} onClick={() => setSource(key)}>
                {SOURCE_SHORT[key]}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Sort by">
            <Chip active={sort === "publicUsd"} onClick={() => setSort("publicUsd")}>
              Public dollars
            </Chip>
            <Chip active={sort === "projects"} onClick={() => setSort("projects")}>
              Named projects
            </Chip>
            <Chip active={sort === "ghBeneficiaries"} onClick={() => setSort("ghBeneficiaries")}>
              Maintainers sponsored on GitHub
            </Chip>
          </FilterGroup>
          <FilterGroup label="Show">
            <Chip active={scope === "ranked"} onClick={() => setScope("ranked")}>
              Top {meta.ranked}
            </Chip>
            <Chip active={scope === "all"} onClick={() => setScope("all")}>
              All {meta.companies}
            </Chip>
            <Toggle checked={whales} onChange={setWhales}>
              Include companies above $100k
            </Toggle>
          </FilterGroup>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-secondary tabular-nums" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? "company" : "companies"}
          </p>
          {filtersActive ? (
            <button type="button" onClick={reset} className="min-h-11 text-sm font-medium text-sage">
              Reset filters
            </button>
          ) : null}
        </div>
      </div>
      <div className="mx-auto max-w-[1120px] pb-16">
        <RankTable rows={filtered} />
      </div>
    </Shell>
  );
}
