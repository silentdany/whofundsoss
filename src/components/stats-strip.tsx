import { formatUsd } from "@/lib/format";
import type { RankingStats } from "@/lib/data";

export function StatsStrip({ stats }: { stats: RankingStats }) {
  const items = [
    {
      label: "Companies",
      value: stats.companies.toLocaleString("en-US"),
    },
    {
      label: "Public $",
      value: formatUsd(stats.publicUsd) ?? "—",
    },
    {
      label: "Sources",
      value: stats.sources.toLocaleString("en-US"),
    },
  ];

  return (
    <div
      className="grid grid-cols-3 divide-x divide-border/70 rounded-md border border-border/70 bg-card"
      aria-label="Ranking overview"
    >
      {items.map((item) => (
        <div key={item.label} className="px-4 py-4 sm:px-5">
          <div className="font-mono text-[20px] font-semibold leading-none tracking-tight tabular-nums text-foreground sm:text-[22px]">
            {item.value}
          </div>
          <div className="mt-1.5 text-[12px] text-muted-foreground">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}
