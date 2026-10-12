import { createFileRoute, Link } from "@tanstack/react-router";
import { PageIntro, Shell } from "@/components/shell";
import { pageHead } from "@/lib/seo";
import { PAGE_TITLES } from "@/lib/site";
import { SPAM_DENYLIST_VERSION } from "@/lib/spam-denylist";

type Endpoint = { path: string; summary: string; params?: [string, string][]; example: string };

const ENDPOINTS: Endpoint[] = [
  {
    path: "/api/projects",
    summary: "Open source projects named by at least 3 companies, most sponsors first.",
    params: [
      ["page", "Page number, from 1. Default 1."],
      ["per_page", "Items per page, 1 to 100. Default 50."],
      ["source", "Only projects with a sponsorship from this source: gh, oc, osp or own."],
      ["q", "Text match on the project slug or name."],
      ["sponsor", "Only projects funded by this company slug."],
      ["min_sponsors", "Minimum number of sponsoring companies. Default and floor 3."],
    ],
    example: "/api/projects?source=oc&per_page=20",
  },
  {
    path: "/api/projects/{slug}",
    summary: "One project with every company that names it, the source and the public amount.",
    example: "/api/projects/webpack",
  },
  {
    path: "/api/sponsors/{slug}",
    summary: "One company: rank, public total, totals by source and each sponsorship.",
    example: "/api/sponsors/getsentry",
  },
  {
    path: "/api/movements?week=YYYY-MM-DD",
    summary:
      "Weekly changes from the scraper: new and disappeared sponsors, amount changes, new GitHub sponsorships, beneficiary count changes and renames. A 404 lists the available weeks.",
    params: [["week", "Required. Date of the weekly snapshot, for example 2026-10-12."]],
    example: "/api/movements?week=2026-10-06",
  },
  {
    path: "/api/denylist",
    summary: "The public spam denylist, the same file as /denylist.json.",
    example: "/api/denylist",
  },
];

const ENVELOPE = `{
  "meta": {
    "api_version": "v1",
    "snapshot_date": "2026-10-06",
    "snapshot_hash": "b3cff2ed...",
    "denylist_version": "${SPAM_DENYLIST_VERSION}",
    "sources": [{ "key": "oc", "name": "Open Collective" }]
  },
  "pagination": { "page": 1, "per_page": 50, "total": 120, "total_pages": 3 },
  "data": [ ... ]
}`;

const PRIVATE = `{
  "source": "gh",
  "source_name": "GitHub Sponsors",
  "amount_usd": null,
  "private": true
}`;

export const Route = createFileRoute("/api/")({
  head: () =>
    pageHead({
      path: "/api",
      title: PAGE_TITLES.api,
      description:
        "Free read-only JSON API for WhoFundsOSS: projects, sponsors, weekly movements and the spam denylist. No key, open CORS, published dollars only.",
    }),
  component: ApiDocsPage,
});

function ApiDocsPage() {
  return (
    <Shell>
      <PageIntro
        eyebrow="Version 1 · read-only"
        title="Public API."
        lede="The same public record as the site, as JSON. No key, no sign-up, no writes. Open CORS, so you can call it from a browser."
      />
      <article className="mx-auto max-w-[720px] space-y-10 px-5 pb-20 text-base leading-relaxed text-secondary">
        <section id="rules">
          <h2 className="font-serif text-2xl text-ink">How it works</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5">
            <li>
              Data comes from the site snapshot and changes only when a new weekly snapshot ships. Responses are cached
              for up to an hour at the edge and carry an ETag.
            </li>
            <li>
              Every response states its source (GitHub Sponsors, Open Collective, Open Source Pledge or a company's own
              program), the snapshot date and the denylist version.
            </li>
            <li>
              Private GitHub Sponsors amounts are never published: <code className="font-mono text-sm">amount_usd</code> is{" "}
              <code className="font-mono text-sm">null</code> and <code className="font-mono text-sm">private</code> is{" "}
              <code className="font-mono text-sm">true</code>.
            </li>
            <li>
              Spam, excluded companies (see{" "}
              <Link to="/method" className="text-sage">
                the method
              </Link>
              ) and companies on a weekly hold are left out of every route. A spam slug returns 404.
            </li>
            <li>
              Basic rate limit: 60 requests per minute per client. Over the limit you get a 429 with a Retry-After header.
            </li>
            <li>Amounts are in USD. Open Collective figures are cumulative, Pledge figures are annual.</li>
          </ul>
        </section>

        <section id="envelope">
          <h2 className="font-serif text-2xl text-ink">Response shape</h2>
          <pre className="mt-4 overflow-x-auto rounded border border-line p-4 font-mono text-xs text-ink">{ENVELOPE}</pre>
          <p className="mt-4 text-sm">A private amount looks like this:</p>
          <pre className="mt-2 overflow-x-auto rounded border border-line p-4 font-mono text-xs text-ink">{PRIVATE}</pre>
          <p className="mt-4 text-sm">
            Errors use <code className="font-mono">{`{ "error": { "status", "message" } }`}</code> with the matching
            HTTP status.
          </p>
        </section>

        <section id="endpoints">
          <h2 className="font-serif text-2xl text-ink">Endpoints</h2>
          <div className="mt-4 space-y-8">
            {ENDPOINTS.map((ep) => (
              <div key={ep.path} className="border-t border-line pt-4">
                <h3 className="font-mono text-sm text-ink">GET {ep.path}</h3>
                <p className="mt-2">{ep.summary}</p>
                {ep.params ? (
                  <table className="mt-3 w-full text-left text-sm">
                    <tbody>
                      {ep.params.map(([name, text]) => (
                        <tr key={name} className="border-t border-line align-top">
                          <td className="py-2 pr-4 font-mono text-xs text-ink">{name}</td>
                          <td className="py-2">{text}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                <p className="mt-3 text-sm">
                  Try it:{" "}
                  <a className="font-mono text-xs text-sage" href={ep.example}>
                    {ep.example}
                  </a>
                </p>
              </div>
            ))}
          </div>
        </section>
      </article>
    </Shell>
  );
}
