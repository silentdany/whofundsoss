"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Amount } from "@/components/amount";
import type { ProjectRow } from "@/lib/data";
import { platformShort, projectLabel } from "@/lib/format";

export function ProjectsTable({ projects }: { projects: ProjectRow[] }) {
  if (projects.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card px-4 py-10 text-center text-[13px] text-muted-foreground">
        No public sponsored projects listed for this company.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Project</TableHead>
          <TableHead>Platform</TableHead>
          <TableHead className="text-right">Public $</TableHead>
          <TableHead>Since</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((p, idx) => {
          const amount = p.total ?? p.monthly;
          return (
            <TableRow key={`${p.project}-${p.platform}-${idx}`}>
              <TableCell className="font-medium">
                {projectLabel(p.project)}
              </TableCell>
              <TableCell className="text-[12px] text-muted-foreground">
                {platformShort(p.platform)}
              </TableCell>
              <TableCell className="text-right">
                <Amount value={amount} />
              </TableCell>
              <TableCell className="text-[12px] text-muted-foreground">
                {p.since || "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
