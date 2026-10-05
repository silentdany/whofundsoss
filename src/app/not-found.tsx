import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[960px] px-4 py-16 text-center">
        <h1 className="text-[28px] font-semibold">Company not found</h1>
        <p className="mt-2 text-muted-foreground">
          That slug is not in the public ranking.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Back to ranking</Link>
        </Button>
      </main>
    </>
  );
}
