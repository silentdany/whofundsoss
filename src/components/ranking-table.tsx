"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Amount } from "@/components/amount";
import {
  RankingToolbar,
  type SortKey,
  type SourceFilter,
} from "@/components/ranking-toolbar";
import type { RankingRow } from "@/lib/data";
import { platformShort } from "@/lib/format";

function matchesSource(plateformes: string, source: SourceFilter): boolean {
  if (source === "all") return true;
  const short = platformShort(plateformes);
  return short.split(" · ").includes(source);
}

export function RankingTable({ rows }: { rows: RankingRow[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("dollars");
  const [source, setSource] = useState<SourceFilter>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !r.login.toLowerCase().includes(q)) {
        return false;
      }
      return matchesSource(r.plateformes, source);
    });
    list = [...list].sort((a, b) => {
      if (sort === "projects") {
        return b.projects - a.projects || (b.totalPublicUsd ?? -1) - (a.totalPublicUsd ?? -1);
      }
      const av = a.totalPublicUsd;
      const bv = b.totalPublicUsd;
      if (av == null && bv == null) return b.projects - a.projects;
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv - av;
    });
    return list;
  }, [rows, search, sort, source]);

  return (
    <div className="space-y-2.5">
      <RankingToolbar
        search={search}
        onSearch={setSearch}
        sort={sort}
        onSort={setSort}
        source={source}
        onSource={setSource}
      />

      {filtered.length === 0 ? (
        <div className="rounded-md border border-border bg-card px-4 py-10 text-center text-[13px] text-muted-foreground">
          No companies match your search.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Projects</TableHead>
              <TableHead className="text-right">Public $</TableHead>
              <TableHead>Sources</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row, i) => (
              <TableRow key={row.slug}>
                <TableCell className="font-mono tabular-nums text-muted-foreground">
                  {sort === "dollars" && source === "all" && !search
                    ? row.rank
                    : i + 1}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/company/${row.slug}`}
                    className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.projects}
                </TableCell>
                <TableCell className="text-right">
                  <Amount value={row.totalPublicUsd} />
                </TableCell>
                <TableCell className="text-[12px] text-muted-foreground">
                  {platformShort(row.plateformes)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
