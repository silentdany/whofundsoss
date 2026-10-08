import { Link } from "@tanstack/react-router";
import { publicTotal } from "@/lib/format";
import { SOURCE_SHORT, type CompanyRow } from "@/lib/types";

function SourceBadges({ sources }: { sources: CompanyRow["sources"] }) {
  if (!sources.length) return <span className="text-muted">None</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {sources.map((source) => (
        <span key={source} className="rounded-full bg-sand px-2.5 py-0.5 text-xs text-secondary">
          {SOURCE_SHORT[source]}
        </span>
      ))}
    </span>
  );
}

export function RankTable({ rows }: { rows: CompanyRow[] }) {
  if (!rows.length) {
    return <p className="px-5 text-secondary">No company matches these filters. Try clearing one.</p>;
  }

  return (
    <>
      {/* Phone: one card per company, the dollar figure never leaves the screen. */}
      <ul className="divide-y divide-line border-y border-line md:hidden">
        {rows.map((row) => (
          <li key={row.slug} className="relative flex items-start gap-4 px-5 py-4 active:bg-sand">
            <span className="w-7 shrink-0 pt-0.5 text-sm text-muted tabular-nums">{row.rank ?? "–"}</span>
            <div className="min-w-0 flex-1">
              <Link
                to="/company/$slug"
                params={{ slug: row.slug }}
                className="font-medium after:absolute after:inset-0"
              >
                {row.name}
              </Link>
              <div className="mt-1.5">
                <SourceBadges sources={row.sources} />
              </div>
              <p className="mt-1.5 text-xs text-secondary">
                {row.unitemized
                  ? "No named projects"
                  : `${row.projects} named project${row.projects === 1 ? "" : "s"}`}
              </p>
            </div>
            <span className="shrink-0 font-semibold tabular-nums">{publicTotal(row.publicUsd)}</span>
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs tracking-wide text-muted uppercase">
              <th scope="col" className="px-5 py-3 font-medium">
                Rank
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Company
              </th>
              <th scope="col" className="px-3 py-3 text-right font-medium">
                Named projects
              </th>
              <th scope="col" className="px-3 py-3 text-right font-medium">
                Public $
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Where the money shows up
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug} className="relative border-t border-line transition-colors hover:bg-sand/70">
                <td className="px-5 py-3.5 text-muted tabular-nums">{row.rank ?? "–"}</td>
                <td className="px-3 py-3.5">
                  <Link
                    to="/company/$slug"
                    params={{ slug: row.slug }}
                    className="font-medium after:absolute after:inset-0 hover:text-sage"
                  >
                    {row.name}
                  </Link>
                  {row.unitemized ? <span className="mt-0.5 block text-xs text-warn">No named projects</span> : null}
                </td>
                <td className="px-3 py-3.5 text-right tabular-nums">{row.projects}</td>
                <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{publicTotal(row.publicUsd)}</td>
                <td className="px-5 py-3.5">
                  <SourceBadges sources={row.sources} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
