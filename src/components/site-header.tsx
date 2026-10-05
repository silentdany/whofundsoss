import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SiteHeader({ narrow = false }: { narrow?: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur-sm">
      <div
        className={`mx-auto flex items-center gap-5 px-4 py-2.5 ${
          narrow ? "max-w-[720px]" : "max-w-[960px]"
        }`}
      >
        <Link
          href="/"
          className="text-[14px] font-semibold tracking-tight text-foreground/80"
        >
          WhoFundsOSS
        </Link>
        <nav className="flex flex-1 gap-4 text-[13px] text-muted-foreground">
          <Link href="/" className="hover:text-foreground/80">
            Ranking
          </Link>
          <Link href="/method" className="hover:text-foreground/80">
            Method
          </Link>
          <a href="#audit" className="hover:text-foreground/80">
            Audit
          </a>
        </nav>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-7 border-border/80 bg-transparent text-[12px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          <a href="#featured-cta">Featured slot</a>
        </Button>
      </div>
    </header>
  );
}
