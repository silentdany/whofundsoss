import { createFileRoute, Link } from "@tanstack/react-router";
import { AllianceGraph } from "@/components/alliance-graph";
import { PageIntro, Shell } from "@/components/shell";
import { money } from "@/lib/format";
import { loadGraph } from "@/lib/queries";
import { pageHead } from "@/lib/seo";
import { PAGE_TITLES } from "@/lib/site";

export const Route = createFileRoute("/graph")({
  loader: () => loadGraph(),
  head: () =>
    pageHead({
      path: "/graph",
      title: PAGE_TITLES.graph,
      description: "Explore which companies co-fund the same open source projects across Open Collective, GitHub Sponsors and the Pledge. Public sources only.",
    }),
  component: GraphPage,
});

function GraphPage() {
  const { meta, nodes, links, commons } = Route.useLoaderData();
  const names = new Map(nodes.map((node) => [node.id, node.name]));

  return (
    <Shell collectedAt={meta.collectedAt} hash={meta.hash}>
      <PageIntro
        eyebrow="Co-sponsorships"
        title="Who funds the same work."
        lede="Edges connect companies that share at least two distinctive projects — projects with between 2 and 15 sponsors. Webpack and Babel are left out of the drawing on purpose. Everyone funds them, so the picture would be a knot."
      />
      <AllianceGraph nodes={nodes} links={links} />
      <section className="mx-auto max-w-[1120px] px-5 pt-12 pb-6">
        <h2 className="font-serif text-2xl">Alliances, as a list</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {links.slice(0, 12).map((link) => (
            <li key={`${link.a}-${link.b}`} className="py-4 text-sm leading-relaxed">
              <Link to="/company/$slug" params={{ slug: link.a }} className="font-medium">
                {names.get(link.a) ?? link.a}
              </Link>
              <span className="text-muted"> × </span>
              <Link to="/company/$slug" params={{ slug: link.b }} className="font-medium">
                {names.get(link.b) ?? link.b}
              </Link>
              <span className="text-secondary">
                {" "}
                · {link.shared} shared · {link.projects.slice(0, 4).join(", ")}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="mx-auto max-w-[1120px] px-5 pt-8 pb-16">
        <h2 className="font-serif text-2xl">The commons, counted apart</h2>
        <p className="mt-2 max-w-2xl text-sm text-secondary">
          The most-sponsored collectives. Amounts shown are cumulative Open Collective gifts where a
          number exists. Sponsor counts include companies with no public amount.
        </p>
        <ul className="mt-6 space-y-8">
          {commons.map((item) => (
            <li key={item.project} className="border-t border-line pt-5">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-lg font-medium">{item.project}</h3>
                <p className="text-sm text-muted tabular-nums">{item.sponsors} sponsors</p>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {item.funders.length ? (
                  item.funders.map((funder) => (
                    <li key={funder.slug} className="flex justify-between gap-4">
                      <Link to="/company/$slug" params={{ slug: funder.slug }} className="hover:text-sage">
                        {funder.name}
                      </Link>
                      <span className="tabular-nums text-secondary">{money(funder.amountUsd)}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-secondary">No public amount on this collective.</li>
                )}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </Shell>
  );
}
