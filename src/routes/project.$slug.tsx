import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell } from "@/components/shell";
import { collectedLabel, hashShort, money } from "@/lib/format";
import { loadProject } from "@/lib/queries";
import {
  projectDescription,
  projectLead,
  projectTitle,
} from "@/lib/projects";
import { breadcrumbJsonLd, notFoundHead, pageHead } from "@/lib/seo";
import { SOURCE_LABEL } from "@/lib/types";

export const Route = createFileRoute("/project/$slug")({
  loader: async ({ params }) => {
    const project = await loadProject({ data: params.slug });
    if (!project) throw notFound();
    return project;
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return notFoundHead();
    const { project, meta } = loaderData;
    const path = `/project/${params.slug}`;
    return pageHead({
      path,
      title: projectTitle(project.name),
      description: projectDescription(project.name, meta.collectedAt),
      jsonLd: [
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Graph", path: "/graph" },
          { name: project.name, path },
        ]),
      ],
    });
  },
  notFoundComponent: ProjectMissing,
  component: ProjectPage,
});

function ProjectMissing() {
  return (
    <Shell>
      <div className="mx-auto max-w-[1120px] px-5 py-24">
        <h1 className="font-serif text-4xl">No public sponsors named for this project in this snapshot.</h1>
        <Link to="/graph" className="mt-6 inline-block text-sage">
          Back to the graph
        </Link>
      </div>
    </Shell>
  );
}

function ProjectPage() {
  const { project, meta } = Route.useLoaderData();
  const [expanded, setExpanded] = useState(false);
  const visible = useMemo(
    () => (expanded ? project.sponsors : project.sponsors.slice(0, 40)),
    [expanded, project.sponsors],
  );
  const lead = projectLead(project.name, project.sponsorCount, money(project.publicUsdSum));

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
              <Link to="/graph" className="hover:text-ink">
                Graph
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" className="text-secondary">
              {project.name}
            </li>
          </ol>
        </nav>
        <p className="text-sm text-muted">Public record</p>
        <h1 className="mt-3 font-serif text-5xl tracking-tight sm:text-6xl">Who funds {project.name}.</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-secondary">{lead}</p>

        <p className="mt-10 text-sm text-muted">Public record</p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">
          Sorted by public dollars linked to {project.name}. Open Collective amounts are cumulative.
          Pledge dollars are annual when the source says so.
        </p>
        <p className="mt-4 text-sm text-muted tabular-nums">{project.sponsorCount} companies</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left">
            <thead>
              <tr className="text-xs tracking-wide text-muted uppercase">
                <th className="py-3 font-medium">Company</th>
                <th className="py-3 font-medium">Source</th>
                <th className="py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.companySlug} className="border-t border-line">
                  <td className="py-3 pr-4">
                    <Link
                      to="/company/$slug"
                      params={{ slug: row.companySlug }}
                      className="font-medium text-ink hover:text-sage"
                    >
                      {row.companyName}
                    </Link>
                    {row.rank ? (
                      <span className="mt-0.5 block text-xs text-muted">Rank {row.rank}</span>
                    ) : null}
                  </td>
                  <td className="py-3 text-sm text-secondary">{SOURCE_LABEL[row.source]}</td>
                  <td className="py-3 text-right tabular-nums">
                    {row.amountUsd == null ? "Not public" : money(row.amountUsd)}
                    {row.amountLabel && row.amountUsd != null ? (
                      <span className="mt-0.5 block text-xs font-normal text-muted">{row.amountLabel}</span>
                    ) : null}
                    {row.amountUsd == null && row.source === "gh" ? (
                      <span className="mt-0.5 block text-xs font-normal text-muted">
                        monthly tier (not ×12)
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {project.sponsors.length > 40 && !expanded ? (
          <button type="button" className="mt-4 text-sm text-sage" onClick={() => setExpanded(true)}>
            Show all {project.sponsors.length}
          </button>
        ) : null}

        <p className="mt-8 max-w-2xl text-sm text-secondary">
          A missing amount is not a zero gift. It is a private or unpublished figure. See{" "}
          <Link to="/method" className="text-sage">
            Method
          </Link>
          .
        </p>

        <p className="mt-10 text-sm text-muted">
          Snapshot {collectedLabel(meta.collectedAt)} · hash {hashShort(meta.hash)} · Sources: OC ·
          Pledge · GitHub · Own program
        </p>
      </article>
    </Shell>
  );
}
