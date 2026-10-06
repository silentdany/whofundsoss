import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageIntro, Shell } from "@/components/shell";
import { money } from "@/lib/format";
import { loadWatchlist } from "@/lib/queries";
import { pageHead } from "@/lib/seo";
import { formatTitle } from "@/lib/site";

const PIN_KEY = "whofundsoss-pins";

export const Route = createFileRoute("/watchlist")({
  loader: () => loadWatchlist(),
  head: () =>
    pageHead({
      path: "/watchlist",
      title: formatTitle("Open source funding watchlist"),
      description: "A short, versioned list of companies whose open source funding we track closely, with why each is listed and its public dollars from the latest snapshot.",
    }),
  component: WatchlistPage,
});

function WatchlistPage() {
  const { meta, items, picker } = Route.useLoaderData();
  const [pins, setPins] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(PIN_KEY) ?? "[]");
      if (Array.isArray(stored)) setPins(stored.filter((item) => typeof item === "string"));
    } catch {
      setPins([]);
    }
  }, []);

  function toggle(slug: string) {
    setPins((current) => {
      const next = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug];
      localStorage.setItem(PIN_KEY, JSON.stringify(next));
      return next;
    });
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return picker.filter((row) => row.name.toLowerCase().includes(q) || row.slug.includes(q)).slice(0, 6);
  }, [picker, query]);

  const pinnedRows = pins
    .map((slug) => picker.find((row) => row.slug === slug))
    .filter((row): row is (typeof picker)[number] => Boolean(row));

  return (
    <Shell collectedAt={meta.collectedAt} hash={meta.hash}>
      <PageIntro
        eyebrow="Watchlist"
        title="A short list, versioned."
        lede="The desk list ships with the site. Pins stay on this device only. Alerts need a second snapshot — there is nothing to page you about yet."
      />
      <section className="mx-auto max-w-[1120px] px-5 pb-10">
        <ul className="divide-y divide-line border-y border-line">
          {items.map((item) => (
            <li key={item.slug} className="py-5">
              <div className="flex items-baseline justify-between gap-4">
                <Link to="/company/$slug" params={{ slug: item.slug }} className="font-medium">
                  {item.row?.name ?? item.slug}
                </Link>
                <span className="text-sm tabular-nums text-secondary">
                  {item.row ? money(item.row.publicUsd) : "—"}
                  {item.row?.rank ? ` · #${item.row.rank}` : ""}
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">{item.reason}</p>
              <p className="mt-1 text-xs text-muted">Added {item.added}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="mx-auto max-w-[1120px] px-5 pb-16">
        <h2 className="font-serif text-2xl">Pinned here</h2>
        <label className="mt-4 block max-w-md">
          <span className="sr-only">Find a company to pin</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a company to pin"
            className="w-full rounded-full border border-line bg-paper px-5 py-3 outline-none focus:border-sage"
          />
        </label>
        {matches.length ? (
          <ul className="mt-3 max-w-md divide-y divide-line rounded-card border border-line bg-paper">
            {matches.map((row) => (
              <li key={row.slug} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm">{row.name}</span>
                <button type="button" className="min-h-11 text-sm text-sage" onClick={() => toggle(row.slug)}>
                  {pins.includes(row.slug) ? "Unpin" : "Pin"}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {pinnedRows.length ? (
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {pinnedRows.map((row) => (
              <li key={row.slug} className="flex items-center justify-between gap-4 py-3">
                <Link to="/company/$slug" params={{ slug: row.slug }}>
                  {row.name}
                </Link>
                <button type="button" className="min-h-11 text-sm text-secondary" onClick={() => toggle(row.slug)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">No pins on this device.</p>
        )}
      </section>
    </Shell>
  );
}
