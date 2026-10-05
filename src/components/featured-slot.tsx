import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Amount } from "@/components/amount";
import type { RankingRow } from "@/lib/data";

export function FeaturedSlot({ company }: { company: RankingRow }) {
  return (
    <div className="rounded-md border border-[#D9F99D]/70 bg-[#ECFCCB] px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Badge variant="secondary" className="bg-white/70 text-foreground">
          Featured · 7 days
        </Badge>
        <div className="min-w-0 flex-1 text-[13px] leading-snug">
          <Link
            href={`/company/${company.slug}`}
            className="font-semibold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {company.name}
          </Link>
          <span className="text-muted-foreground">
            {" "}
            — sponsoring {company.projects} projects ·{" "}
          </span>
          <Amount value={company.totalPublicUsd} />
          <span className="text-muted-foreground">*</span>
          <span className="ml-1.5 text-[12px] text-muted-foreground">
            Public amounts only
          </span>
        </div>
      </div>
    </div>
  );
}
