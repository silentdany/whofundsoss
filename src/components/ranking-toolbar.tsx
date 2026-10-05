"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SortKey = "dollars" | "projects";
export type SourceFilter = "all" | "GH" | "OC" | "Pledge";

export function RankingToolbar({
  search,
  onSearch,
  sort,
  onSort,
  source,
  onSource,
}: {
  search: string;
  onSearch: (v: string) => void;
  sort: SortKey;
  onSort: (v: SortKey) => void;
  source: SourceFilter;
  onSource: (v: SourceFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 text-muted-foreground">
      <Select value={source} onValueChange={(v) => onSource(v as SourceFilter)}>
        <SelectTrigger
          className="h-8 w-[140px] border-border/80 bg-muted/40 text-[13px] text-muted-foreground shadow-none"
          aria-label="Filter by source"
        >
          <SelectValue placeholder="All sources" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sources</SelectItem>
          <SelectItem value="GH">GitHub Sponsors</SelectItem>
          <SelectItem value="OC">Open Collective</SelectItem>
          <SelectItem value="Pledge">Open Source Pledge</SelectItem>
        </SelectContent>
      </Select>

      <Input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search company…"
        className="h-8 min-w-[160px] flex-1 border-border/80 bg-muted/40 text-[13px] shadow-none"
        aria-label="Search company"
      />

      <Select value={sort} onValueChange={(v) => onSort(v as SortKey)}>
        <SelectTrigger
          className="h-8 w-[180px] border-border/80 bg-muted/40 text-[13px] text-muted-foreground shadow-none"
          aria-label="Sort ranking"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="dollars">Sorted by public $</SelectItem>
          <SelectItem value="projects">Sorted by projects</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
