import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CompanySearch } from "@/components/company-search";
import { Shell } from "@/components/shell";
import { Chip } from "@/components/ui";
import { money, scoreLabel } from "@/lib/format";
import { loadCompany } from "@/lib/queries";
import {
  breadcrumbJsonLd,
  companyDescription,
  companyIndexable,
  companyOrganizationJsonLd,
  companyTitle,
  notFoundHead,
  pageHead,
  ROBOTS_INDEX,
  ROBOTS_NOINDEX,
} from "@/lib/seo";
import {
  formatSponsorshipProjectLabel,
  projectAnchorId,
  sponsorshipSourceUrl,
} from "@/lib/sponsorship-url";
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
        companyOrganizationJsonLd(row),
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
        <p className="mt-3 max-w-lg text-secondary">
          It may be spelled differently, or it may simply not publish any figure. Try another search.
        </p>
        <CompanySearch className="mt-6 max-w-xl" autoFocus />
        <Link to="/ranking" className="mt-6 inline-block font-medium text-sage">
          Or browse the full ranking
        </Link>
      </div>
    </Shell>
  );
}

function CompanyPage() {
  const { row, detail, meta, linkedProjects, narrative } = Route.useLoaderData();
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
        <nav aria-label="Breadcrumb" className="mb-5 text-sm text-secondary">
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
        <p className="eyebrow">
          {row.rank ? `Rank ${row.rank} of ${meta.ranked}` : `Outside the top ${meta.ranked}`}
          {row.sector ? ` · ${row.sector}` : ""}
        </p>
        <h1 className="mt-3 font-serif text-5xl tracking-tight sm:text-6xl">{row.name}</h1>
        {row.site ? (
          <a href={row.site} className="mt-3 inline-block text-sage underline-offset-4 hover:underline" rel="noreferrer" target="_blank">
            {row.site.replace(/^https?:\/\//, "")} <span aria-hidden="true">↗</span>
          </a>
        ) : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-[1.2fr_1fr]">
          <div className="rounded-card bg-sand p-6 sm:p-8">
            <p className="text-sm text-secondary">Public funding found</p>
            <p className="mt-1 font-serif text-5xl tabular-nums sm:text-6xl">{money(row.publicUsd)}</p>
            <p className="mt-3 text-sm leading-relaxed text-secondary">
              A floor, not a total: only amounts the company has made public.
              {row.lowVolume ? " Low volume, so read the score below with care." : ""}
            </p>
          </div>
          <div className="flex flex-col justify-between rounded-card border border-line p-6 sm:p-8">
            <div>
              <p className="text-sm text-secondary">Transparency score</p>
              <p className="mt-1 font-serif text-5xl tabular-nums">
                {scoreLabel(row.transparency)}
                <span className="ml-1 text-xl text-muted">/ 1</span>
              </p>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-secondary">
              {row.projectsWithAmount} of {row.projects} named sponsorships show a public amount.{" "}
              <Link to="/method" className="font-medium text-sage">
                How it is computed
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-8 max-w-2xl space-y-3 text-lg leading-relaxed text-secondary">
          {narrative
            .filter((sentence) => !/^Rank \d+ by public dollars|^Named projects: \d+/.test(sentence))
            .map((sentence) => (
            <p key={sentence}>{sentence}</p>
          ))}
        </div>

        {linkedProjects.length ? (
          <section className="mt-10 max-w-2xl">
            <h2 className="font-serif text-2xl text-ink">Projects it funds</h2>
            <p className="mt-3 text-sm leading-relaxed text-secondary">
              {linkedProjects.map((p, i) => (
                <span key={p.slug}>
                  {i > 0 ? " · " : ""}
                  <Link to="/project/$slug" params={{ slug: p.slug }} className="text-sage">
                    {p.name}
                  </Link>
                </span>
              ))}
            </p>
          </section>
        ) : null}

        {row.dedupedPledge ? (
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-secondary">
            An own-program line repeats the pledge. The total counts those dollars once.
          </p>
        ) : null}

        <section className="mt-10 max-w-2xl">
          <h2 className="font-serif text-2xl text-ink">Where the money comes from</h2>
          <p className="mt-3 text-sm text-secondary">
            {SOURCE_ORDER.filter((key) => row.sources.includes(key))
              .map((key) => SOURCE_LABEL[key])
              .join(" · ")}
            . A pledge dollar is never counted twice.
          </p>
        </section>

        {row.unitemized ? (
          <p className="mt-6 max-w-2xl rounded-card bg-sand px-5 py-4 text-sm leading-relaxed text-warn">
            Dollars are declared but no project is named, so the project side of the score stays at zero. See{" "}
            <Link to="/mysteries" className="text-sage">
              Mysteries
            </Link>
            .
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
                    <p className="mt-1 text-xs text-secondary">Cumulative gifts to date, not a yearly figure.</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <h2 className="mt-14 font-serif text-2xl text-ink">Every funding line</h2>
        <div role="group" aria-label="Filter by source" className="mt-4 flex flex-wrap gap-2">
          <Chip active={source === "all"} onClick={() => setSource("all")}>
            All lines
          </Chip>
          {SOURCE_ORDER.map((key) => (
            <Chip key={key} active={source === key} onClick={() => setSource(key)}>
              {SOURCE_LABEL[key]}
            </Chip>
          ))}
        </div>
        <p className="mt-4 text-sm text-secondary tabular-nums">{lines.length} {lines.length === 1 ? "line" : "lines"}</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs tracking-wide text-muted uppercase">
                <th scope="col" className="py-3 font-medium">Project</th>
                <th scope="col" className="py-3 font-medium">Source</th>
                <th scope="col" className="py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item, index) => {
                const sourceUrl = sponsorshipSourceUrl(item);
                const anchor = projectAnchorId(item.project);
                const internal = linkedProjects.find(
                  (p) => p.slug === item.project.trim().toLowerCase(),
                );
                return (
                  <tr
                    key={`${item.project}-${item.source}-${index}`}
                    id={anchor ? `project-${anchor}` : undefined}
                    className="border-t border-line"
                  >
                    <td className="py-3 pr-4">
                      {internal ? (
                        <Link
                          to="/project/$slug"
                          params={{ slug: internal.slug }}
                          className="text-ink hover:text-sage"
                        >
                          {formatSponsorshipProjectLabel(item.project)}
                        </Link>
                      ) : sourceUrl ? (
                        <a
                          href={sourceUrl}
                          className="text-ink hover:text-sage"
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {formatSponsorshipProjectLabel(item.project)}
                        </a>
                      ) : (
                        formatSponsorshipProjectLabel(item.project)
                      )}
                      {internal && sourceUrl ? (
                        <a
                          href={sourceUrl}
                          className="mt-0.5 block text-xs text-muted hover:text-sage"
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          Public source
                        </a>
                      ) : null}
                    </td>
                    <td className="py-3 text-sm text-secondary">{SOURCE_LABEL[item.source]}</td>
                    <td className="py-3 text-right tabular-nums">
                      {item.amountUsd == null ? <span className="text-secondary">Not public</span> : money(item.amountUsd)}
                      {item.cumulative && item.amountUsd != null ? (
                        <span className="mt-0.5 block text-xs font-normal text-muted">Cumulative</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {lines.length > 40 && !expanded ? (
          <button type="button" className="mt-4 text-sm text-sage" onClick={() => setExpanded(true)}>
            Show all {lines.length}
          </button>
        ) : null}

        <p className="mt-12 max-w-xl text-sm leading-relaxed text-secondary">
          Rank always follows public dollars. Featured placements are labeled and never change a rank. See{" "}
          <Link to="/method" className="font-medium text-sage">
            how we count
          </Link>{" "}
          or{" "}
          <Link to="/movements" className="font-medium text-sage">
            what changed since the last snapshot
          </Link>
          .
        </p>
      </article>
    </Shell>
  );
}
