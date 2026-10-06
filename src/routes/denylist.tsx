import { createFileRoute, Link } from "@tanstack/react-router";
import denylist from "@/data/public-spam-denylist.json";
import { PageIntro, Shell } from "@/components/shell";
import { pageHead } from "@/lib/seo";
import { PAGE_TITLES } from "@/lib/site";
import { SPAM_DENYLIST_VERSION } from "@/lib/spam-denylist";

type DenylistFile = {
  title: string;
  version: string;
  as_of: string;
  summary: string;
  counts: { total: number; by_category: Record<string, number> };
  criteria: Record<string, string>;
  entries: { slug: string; category: string; reason: string }[];
  reviewed_and_not_listed: { slug: string; note: string }[];
};

const data = denylist as DenylistFile;

export const Route = createFileRoute("/denylist")({
  head: () =>
    pageHead({
      path: "/denylist",
      title: PAGE_TITLES.denylist,
      description:
        "Public spam denylist for WhoFundsOSS: noindex company pages, criteria, counts, and versioned entries. Ranking dollars are unchanged.",
    }),
  component: DenylistPage,
});

function DenylistPage() {
  const categories = Object.entries(data.counts.by_category).sort((a, b) => a[0].localeCompare(b[0]));
  const entries = [...data.entries].sort((a, b) =>
    a.category === b.category ? a.slug.localeCompare(b.slug) : a.category.localeCompare(b.category),
  );

  return (
    <Shell>
      <PageIntro
        eyebrow={`Version ${data.version} · as of ${data.as_of}`}
        title="Spam denylist."
        lede={data.summary}
      />
      <article className="mx-auto max-w-[720px] space-y-10 px-5 pb-20 text-base leading-relaxed text-secondary">
        <p className="text-sm">
          Machine copy:{" "}
          <a className="text-sage" href="/denylist.json">
            denylist.json
          </a>
          {" · "}
          <a className="text-sage" href="/denylist.md">
            denylist.md
          </a>
          . Code gate version: {SPAM_DENYLIST_VERSION}. Method:{" "}
          <Link to="/method" className="text-sage">
            /method
          </Link>
          .
        </p>

        <section id="criteria">
          <h2 className="font-serif text-2xl text-ink">Counts by category</h2>
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="text-xs tracking-wide text-muted uppercase">
                <th className="py-2 font-medium">Category</th>
                <th className="py-2 text-right font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(([cat, n]) => (
                <tr key={cat} className="border-t border-line">
                  <td className="py-2 pr-4 text-ink">{cat}</td>
                  <td className="py-2 text-right tabular-nums">{n}</td>
                </tr>
              ))}
              <tr className="border-t border-line">
                <td className="py-2 pr-4 font-medium text-ink">Total</td>
                <td className="py-2 text-right tabular-nums font-medium text-ink">{data.counts.total}</td>
              </tr>
            </tbody>
          </table>
          <ul className="mt-6 space-y-3">
            {Object.entries(data.criteria).map(([cat, text]) => (
              <li key={cat}>
                <span className="text-ink">{cat}</span> — {text}
              </li>
            ))}
          </ul>
        </section>

        <section id="entries">
          <h2 className="font-serif text-2xl text-ink">Entries</h2>
          <p className="mt-3 text-sm">
            Listed companies stay in the ranking. Their company page is served with noindex,follow and
            is omitted from sitemap.xml. Every public dollar figure is unchanged.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="text-xs tracking-wide text-muted uppercase">
                  <th className="py-3 font-medium">Slug</th>
                  <th className="py-3 font-medium">Category</th>
                  <th className="py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => (
                  <tr key={row.slug} className="border-t border-line align-top">
                    <td className="py-2 pr-3">
                      <Link
                        to="/company/$slug"
                        params={{ slug: row.slug }}
                        className="font-mono text-xs text-sage"
                      >
                        {row.slug}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-ink">{row.category}</td>
                    <td className="py-2">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {data.reviewed_and_not_listed.length ? (
          <section id="reviewed">
            <h2 className="font-serif text-2xl text-ink">Reviewed and not listed</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {data.reviewed_and_not_listed.map((row) => (
                <li key={row.slug}>
                  <span className="font-mono text-xs text-ink">{row.slug}</span> — {row.note}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </Shell>
  );
}
