import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SiteHeader({ narrow = false }: { narrow?: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card">
      <div
        className={`mx-auto flex items-center gap-5 px-4 py-3 ${
          narrow ? "max-w-[720px]" : "max-w-[960px]"
        }`}
      >
        <Link
          href="/"
          className="text-[15px] font-semibold tracking-tight text-foreground"
        >
          WhoFundsOSS
        </Link>
        <nav className="flex flex-1 gap-4 text-[13px] text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Ranking
          </Link>
          <Link href="/method" className="hover:text-foreground">
            Method
          </Link>
          <a href="#audit" className="hover:text-foreground">
            Audit
          </a>
        </nav>
        <Button asChild variant="secondary" size="sm">
          <a href="#featured-cta">Featured slot</a>
        </Button>
      </div>
    </header>
  );
}
