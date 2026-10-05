import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { FeaturedSlot } from "@/components/featured-slot";
import { RankingTable } from "@/components/ranking-table";
import { DisclaimerCta } from "@/components/disclaimer-cta";
import { Button } from "@/components/ui/button";
import { getFeatured, getRanking } from "@/lib/data";

export default function HomePage() {
  const ranking = getRanking();
  const featured = getFeatured();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[960px] space-y-6 px-4 pb-16 pt-7">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-foreground">
            Who really funds open source
          </h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            Companies → projects. Public data, updated monthly.
          </p>
          <div className="mt-4">
            <Button asChild variant="outline">
              <a href="#featured-cta">Get a Featured slot →</a>
            </Button>
          </div>
        </div>

        {featured ? <FeaturedSlot company={featured} /> : null}

        <RankingTable rows={ranking} />

        <DisclaimerCta />

        <p className="text-[12px] text-muted-foreground">
          Data freshness 2026-10-05 ·{" "}
          <Link href="/method" className="text-primary hover:underline">
            Method & limits
          </Link>
        </p>
      </main>
    </>
  );
}
