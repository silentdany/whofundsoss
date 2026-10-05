import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Amount } from "@/components/amount";
import type { RankingRow } from "@/lib/data";

export function FeaturedSlot({ company }: { company: RankingRow }) {
  return (
    <Card className="border-[#D9F99D] bg-accent px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <Badge>Featured · 7 days</Badge>
        <div className="min-w-0 flex-1">
          <div className="text-[14px]">
            <Link
              href={`/company/${company.slug}`}
              className="font-semibold text-foreground hover:underline"
            >
              {company.name}
            </Link>
            <span className="text-muted-foreground">
              {" "}
              — sponsoring {company.projects} projects ·{" "}
            </span>
            <Amount value={company.totalPublicUsd} />
            <span className="text-muted-foreground">*</span>
          </div>
          <div className="text-[12px] text-muted-foreground">
            * Public amounts only
          </div>
        </div>
      </div>
    </Card>
  );
}
