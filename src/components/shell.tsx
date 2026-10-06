import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collectedLabel, hashShort } from "@/lib/format";

const RECORD = [
  { to: "/", label: "Home" },
  { to: "/ranking", label: "Ranking" },
  { to: "/movements", label: "Movements" },
  { to: "/mysteries", label: "Mysteries" },
  { to: "/graph", label: "Graph" },
  { to: "/watchlist", label: "Watchlist" },
] as const;

const ABOUT = [
  { to: "/method", label: "Method" },
  { to: "/ranking", label: "Full ranking" },
] as const;

function Mark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 2.2v19.6M3.4 7.1l17.2 9.8M20.6 7.1 3.4 16.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Shell({
  children,
  collectedAt,
  hash,
}: {
  children: React.ReactNode;
  collectedAt?: string;
  hash?: string;
}) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        href="#content"
        className="absolute -left-[999px] top-3 z-[70] rounded-full bg-paper px-4 py-2 focus:left-3"
      >
        Skip to content
      </a>
      <Header />
      <main id="content">{children}</main>
      <Footer collectedAt={collectedAt} hash={hash} />
    </div>
  );
}

function Header() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-40 bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-5">
          <Link
            to="/"
            className="flex items-center gap-2 text-ink"
            aria-label="WhoFundsOSS home"
            onClick={() => setOpen(false)}
          >
            <Mark className="size-7" />
            <span className="text-[1.15rem] leading-none font-semibold tracking-tight">WhoFundsOSS</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-secondary md:flex">
            <Link to="/ranking" className="hover:text-ink" activeProps={{ className: "text-ink" }}>
              Ranking
            </Link>
            <Link to="/movements" className="hover:text-ink" activeProps={{ className: "text-ink" }}>
              Movements
            </Link>
            <Link to="/method" className="hover:text-ink" activeProps={{ className: "text-ink" }}>
              Method
            </Link>
          </nav>
          <button
            type="button"
            className="flex size-11 items-center justify-center md:hidden"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="flex w-6 flex-col gap-1.5">
              <span className="block h-px w-full bg-ink" />
              <span className="block h-px w-full bg-ink" />
            </span>
          </button>
        </div>
      </header>
      {open ? (
        <div className="fixed inset-0 z-50 text-paper" role="dialog" aria-modal="true" aria-label="Menu">
          <img src="/art/meadow.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_62%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-overlay/88 via-overlay/62 to-overlay/25" />
          <div className="relative mx-auto flex h-full max-w-[1120px] flex-col px-5 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-sm tracking-tight">WhoFundsOSS</span>
              <button
                type="button"
                className="flex size-11 items-center justify-center text-2xl leading-none"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                ×
              </button>
            </div>
            <div className="mt-10 grid gap-10 sm:grid-cols-2">
              <div>
                <p className="text-sm text-paper/70">Record</p>
                <ul className="mt-4 space-y-1">
                  {RECORD.map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className="block py-2 font-serif text-4xl leading-none"
                        onClick={() => setOpen(false)}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm text-paper/70">About</p>
                <ul className="mt-4 space-y-1">
                  {ABOUT.map((item) => (
                    <li key={item.label}>
                      <Link
                        to={item.to}
                        className="block py-2 text-2xl"
                        onClick={() => setOpen(false)}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Footer({ collectedAt, hash }: { collectedAt?: string; hash?: string }) {
  return (
    <footer className="relative mt-4 min-h-[34rem] text-paper">
      <img
        src="/art/meadow.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[center_58%]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-overlay/90 via-overlay/55 to-overlay/20" />
      <div className="relative mx-auto grid max-w-[1120px] gap-12 px-5 pt-12 sm:grid-cols-2 sm:pt-16">
        <div>
          <p className="font-serif text-3xl">Record</p>
          <ul className="mt-5 space-y-3 text-lg">
            {RECORD.slice(1).map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="inline-flex min-h-11 items-center hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-serif text-3xl">About</p>
          <ul className="mt-5 space-y-3 text-lg">
            <li>
              <Link to="/method" className="inline-flex min-h-11 items-center hover:underline">
                Method
              </Link>
            </li>
            <li>
              <Link to="/mysteries" className="inline-flex min-h-11 items-center hover:underline">
                Mysteries
              </Link>
            </li>
            <li>
              <Link to="/watchlist" className="inline-flex min-h-11 items-center hover:underline">
                Watchlist
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="relative mx-auto flex max-w-[1120px] flex-wrap gap-x-6 gap-y-2 px-5 pt-16 pb-8 text-sm text-paper/90">
        <span>© {collectedAt?.slice(0, 4) ?? "2026"} WhoFundsOSS</span>
        <span>Data CC BY 4.0</span>
        {collectedAt ? <span>Collected {collectedLabel(collectedAt)}</span> : null}
        {hash ? <span className="tabular-nums">Snapshot {hashShort(hash)}</span> : null}
      </div>
    </footer>
  );
}

export function PageIntro({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede: string;
}) {
  return (
    <header className="mx-auto max-w-[1120px] px-5 pt-8 pb-6 sm:pt-12">
      <p className="text-sm text-muted">{eyebrow}</p>
      <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-[1.08] tracking-tight sm:text-5xl">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-secondary">{lede}</p>
    </header>
  );
}
