import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stripeSlot =
  process.env.NEXT_PUBLIC_STRIPE_SLOT_URL || "#featured-cta";
const stripeAudit =
  process.env.NEXT_PUBLIC_STRIPE_AUDIT_URL || "#audit";

export function DisclaimerCta() {
  return (
    <div id="audit" className="space-y-3">
      <Alert variant="warn">
        <AlertTitle>⚠ Public amounts only</AlertTitle>
        <AlertDescription>
          <p className="mb-0">
            GitHub Sponsors amounts are often private. Totals can be incomplete.
            We show who funds whom — not a full budget.{" "}
            <Link href="/method" className="font-medium text-primary underline-offset-2 hover:underline">
              Method →
            </Link>
          </p>
        </AlertDescription>
      </Alert>

      <div
        id="featured-cta"
        className="grid gap-3 sm:grid-cols-2"
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px]">Get visibility</CardTitle>
            <p className="font-mono text-[13px] text-muted-foreground">
              Featured slot · $199–399 / 7 days
            </p>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <a href={stripeSlot}>Buy Featured slot →</a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px]">Get clarity</CardTitle>
            <p className="font-mono text-[13px] text-muted-foreground">
              Sponsoring audit · $490 founders · $990
            </p>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full sm:w-auto">
              <a href={stripeAudit}>Request audit →</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
