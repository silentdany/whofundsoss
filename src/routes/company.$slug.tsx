import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell } from "@/components/shell";
import { money, scoreLabel } from "@/lib/format";
import { loadCompany } from "@/lib/queries";
import {
  breadcrumbJsonLd,
  companyDescription,
  companyIndexable,
  companyTitle,
  notFoundHead,
  pageHead,
  ROBOTS_INDEX,
  ROBOTS_NOINDEX,
} from "@/lib/seo";
import { SOURCE_LABEL, SOURCE_ORDER, type SourceKey } from "@/lib/types";

export const Route = createFileRoute("/company/$slug")({
  loader: async ({ params }) => {
    const company = await loadCompany({ data: params.slug });
    if (!company) throw notFound();
    return company;
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return notFoundHead();
    const { row, detail, meta } = loaderData;
    const path = `/company/${params.slug}`;
    return pageHead({
      path,
      title: companyTitle(row),
      description: companyDescription(row, detail, meta),
      robots: companyIndexable(row, detail) ? ROBOTS_INDEX : ROBOTS_NOINDEX,
      jsonLd: [
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Ranking", path: "/ranking" },
          { name: row.name, path },
        ]),
      ],
    });
  },
  notFoundComponent: CompanyMissing,
  component: CompanyPage,
});

function CompanyMissing() {
  return (
    <Shell>
      <div className="mx-auto max-w-[1120px] px-5 py-24">
        <h1 className="font-serif text-4xl">No such company in this file.</h1>
        <Link to="/ranking" className="mt-6 inline-block text-sage">
          Back to the ranking
        </Link>
      </div>
    </Shell>
  );
}

function CompanyPage() {
  const { row, detail, meta } = Route.useLoaderData();
  const [source, setSource] = useState<SourceKey | "all">("all");
  const [expanded, setExpanded] = useState(false);

  const lines = useMemo(() => {
    const next =
      source === "all" ? detail.sponsorships : detail.sponsorships.filter((item) => item.source === source);
    return [...next].sort((a, b) => (b.amountUsd ?? -1) - (a.amountUsd ?? -1));
  }, [detail.sponsorships, source]);

  const visible = expanded ? lines : lines.slice(0, 40);
  const maxBar = Math.max(row.publicUsd, 1);

  return (
    <Shell collectedAt={meta.collectedAt} hash={meta.hash}>
      <article className="mx-auto max-w-[1120px] px-5 pt-8 pb-16 sm:pt-12">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
          <ol className="flex flex-wrap items-center gap-x-2">
            <li>
              <Link to="/" className="hover:text-ink">
                Home
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li>
              <Link to="/ranking" className="hover:text-ink">
                Ranking
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" className="text-secondary">
              {row.name}
            </li>
          </ol>
        </nav>
        <p className="text-sm text-muted">
          {row.rank ? `Rank ${row.rank} by public dollars` : "Outside the top 200"}
          {row.sector ? ` · ${row.sector}` : ""}
        </p>
        <h1 className="mt-3 font-serif text-5xl tracking-tight sm:text-6xl">Who {row.name} funds in open source</h1>
        {row.site ? (
          <a href={row.site} className="mt-4 inline-block text-sage" rel="noreferrer" target="_blank">
            {row.site.replace(/^https?:\/\//, "")}
          </a>
        ) : null}

        <div className="mt-10 grid gap-8 border-y border-line py-8 sm:grid-cols-[auto_1fr] sm:items-end">
          <div>
            <p className="font-serif text-5xl tabular-nums">{scoreLabel(row.transparency)}</p>
            <p className="mt-1 text-sm text-muted">Transparency, 0 to 1</p>
          </div>
          <div>
            <p className="font-serif text-3xl tabular-nums">{money(row.publicUsd)} public</p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-secondary">
              60% is this total against the leader ({money(meta.maxPublicUsd)}). 40% is how many
              named sponsorships carry a public amount ({row.projectsWithAmount} of {row.projects}).
              {row.lowVolume ? " Low volume — do not read the score without the dollars." : ""}
            </p>
          </div>
        </div>

        {row.dedupedPledge ? (
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-secondary">
            An own-program line repeats the pledge. The total counts those dollars once.
          </p>
        ) : null}

        {row.unitemized ? (
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-warn">
            Dollars are declared and no project is named. Coverage of the score stays at zero.
          </p>
        ) : (
          <ul className="mt-8 max-w-xl space-y-4">
            {SOURCE_ORDER.map((key) => {
              const amount = detail.bySource[key];
              if (!amount) return null;
              return (
                <li key={key}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span>{SOURCE_LABEL[key]}</span>
                    <span className="tabular-nums">{money(amount)}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand">
                    <div className="h-full bg-sage" style={{ width: `${Math.max(2, (amount / maxBar) * 100)}%` }} />
                  </div>
                  {key === "oc" ? (
                    <p className="mt-1 text-xs text-muted">Cumulative historical gifts, not a run-rate.</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-14 flex flex-wrap gap-2">
          <Chip active={source === "all"} onClick={() => setSource("all")}>
            All lines
          </Chip>
          {SOURCE_ORDER.map((key) => (
            <Chip key={key} active={source === key} onClick={() => setSource(key)}>
              {SOURCE_LABEL[key]}
            </Chip>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted tabular-nums">{lines.length} lines</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left">
            <thead>
              <tr className="text-xs tracking-wide text-muted uppercase">
                <th className="py-3 font-medium">Project</th>
                <th className="py-3 font-medium">Source</th>
                <th className="py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item, index) => (
                <tr key={`${item.project}-${item.source}-${index}`} className="border-t border-line">
                  <td className="py-3 pr-4">{item.project}</td>
                  <td className="py-3 text-sm text-secondary">{SOURCE_LABEL[item.source]}</td>
                  <td className="py-3 text-right tabular-nums">
                    {item.amountUsd == null ? "Not public" : money(item.amountUsd)}
                    {item.cumulative && item.amountUsd != null ? (
                      <span className="mt-0.5 block text-xs font-normal text-muted">Cumulative</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lines.length > 40 && !expanded ? (
          <button type="button" className="mt-4 text-sm text-sage" onClick={() => setExpanded(true)}>
            Show all {lines.length}
          </button>
        ) : null}

        <p className="mt-12 max-w-xl text-sm text-secondary">
          Rank movement vs the prior snapshot is on /movements when both collections exist.
        </p>
      </article>
    </Shell>
  );
}

function Chip({
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
          : "min-h-11 rounded-full bg-sand px-4 text-sm"
      }
    >
      {children}
    </button>
  );
}
