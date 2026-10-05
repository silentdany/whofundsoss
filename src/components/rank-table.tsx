import { Link } from "@tanstack/react-router";
import { money } from "@/lib/format";
import { SOURCE_SHORT, type CompanyRow } from "@/lib/types";

export function RankTable({ rows }: { rows: CompanyRow[] }) {
  if (!rows.length) {
    return <p className="px-5 text-secondary">Nothing matches.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left">
        <thead>
          <tr className="text-xs tracking-wide text-muted uppercase">
            <th className="px-5 py-3 font-medium">Rank</th>
            <th className="px-3 py-3 font-medium">Company</th>
            <th className="px-3 py-3 text-right font-medium">Projects</th>
            <th className="px-3 py-3 text-right font-medium">Public $</th>
            <th className="px-5 py-3 font-medium">Sources</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.slug} className="border-t border-line">
              <td className="px-5 py-3.5 tabular-nums text-muted">{row.rank ?? "—"}</td>
              <td className="px-3 py-3.5">
                <Link to="/company/$slug" params={{ slug: row.slug }} className="font-medium hover:text-sage">
                  {row.name}
                </Link>
                {row.unitemized ? (
                  <span className="mt-0.5 block text-xs text-warn">No named projects</span>
                ) : null}
              </td>
              <td className="px-3 py-3.5 text-right tabular-nums">{row.projects}</td>
              <td className="px-3 py-3.5 text-right tabular-nums">{money(row.publicUsd)}</td>
              <td className="px-5 py-3.5 text-sm text-secondary">
                {row.sources.map((source) => SOURCE_SHORT[source]).join(" · ") || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
