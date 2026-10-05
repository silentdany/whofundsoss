import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { DisclaimerCta } from "@/components/disclaimer-cta";
import { ProjectsTable } from "@/components/projects-table";
import { Amount } from "@/components/amount";
import { SourceBadges } from "@/components/source-badges";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCompany, getCompanySlugs } from "@/lib/data";
import { secteurLabel } from "@/lib/format";

export function generateStaticParams() {
  return getCompanySlugs().map((slug) => ({ slug }));
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = getCompany(slug);
  if (!company) notFound();

  const initials = company.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const stripeSlot =
    process.env.NEXT_PUBLIC_STRIPE_SLOT_URL || "#featured-cta";
  const stripeAudit =
    process.env.NEXT_PUBLIC_STRIPE_AUDIT_URL || "#audit";

  return (
    <>
      <SiteHeader narrow />
      <main className="mx-auto max-w-[720px] space-y-6 px-4 pb-16 pt-5">
        <Link
          href="/"
          className="inline-block text-[13px] text-muted-foreground hover:text-foreground"
        >
          ← Ranking
        </Link>

        <Card>
          <CardContent className="flex gap-3.5 p-5">
            <Avatar>
              <AvatarFallback>{initials || "?"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
                {company.name}
              </h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {[secteurLabel(company.secteur), company.login ? `@${company.login}` : null]
                  .filter(Boolean)
                  .join(" · ") || "Open-source sponsor"}
                {company.site ? (
                  <>
                    {" · "}
                    <a
                      href={company.site}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      Website
                    </a>
                  </>
                ) : null}
              </p>

              <div className="mt-4 grid grid-cols-3 gap-3 rounded-md border border-border/70 bg-muted/30 px-3.5 py-3 sm:gap-5">
                <div>
                  <div className="font-mono text-[16px] font-semibold tabular-nums">
                    {company.projectsCount}
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    Projects
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[16px] font-semibold tabular-nums">
                    <Amount value={company.totalPublicUsd} />
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    Public $*
                  </div>
                </div>
                <div>
                  <SourceBadges plateformes={company.plateformes} />
                  <div className="mt-1 text-[12px] text-muted-foreground">
                    Sources
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2.5">
                <Button asChild>
                  <a href={stripeAudit}>Request sponsoring audit →</a>
                </Button>
                <Button asChild variant="outline">
                  <a href={stripeSlot}>Featured slot</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-semibold">Sponsored projects</h2>
          <ProjectsTable projects={company.projects} />
        </section>

        <DisclaimerCta />
      </main>
    </>
  );
}
