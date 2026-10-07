import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collectedLabel, hashShort } from "@/lib/format";

const NAV = [
  { to: "/ranking", label: "Ranking", hint: "Who gives the most" },
  { to: "/movements", label: "Movements", hint: "What changed since last time" },
  { to: "/graph", label: "Graph", hint: "Who funds the same projects" },
  { to: "/mysteries", label: "Mysteries", hint: "Numbers that don't add up" },
  { to: "/watchlist", label: "Watchlist", hint: "Companies worth following" },
  { to: "/method", label: "Method", hint: "How we count" },
] as const;

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
            className="flex min-h-11 items-center gap-2 text-ink"
            aria-label="WhoFundsOSS home"
            onClick={() => setOpen(false)}
          >
            <img src="/favicon.svg" alt="" width={28} height={28} className="size-7 shrink-0" />
            <span className="text-[1.15rem] leading-none font-semibold tracking-tight">WhoFundsOSS</span>
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 text-sm md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-full px-3 py-2 text-secondary transition-colors hover:bg-sand hover:text-ink"
                activeProps={{ className: "bg-sand text-ink font-medium", "aria-current": "page" }}
              >
                {item.label}
              </Link>
            ))}
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
          <div className="relative mx-auto flex h-full max-w-[1120px] flex-col overflow-y-auto px-5 pt-5 pb-8">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold tracking-tight">WhoFundsOSS</span>
              <button
                type="button"
                className="flex size-11 items-center justify-center text-2xl leading-none"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                ×
              </button>
            </div>
            <nav aria-label="Menu" className="mt-8">
              <ul className="space-y-1">
                {NAV.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="block py-2.5"
                      activeProps={{ "aria-current": "page" }}
                      onClick={() => setOpen(false)}
                    >
                      <span className="block font-serif text-4xl leading-none">{item.label}</span>
                      <span className="mt-1 block text-sm text-paper/75">{item.hint}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Footer({ collectedAt, hash }: { collectedAt?: string; hash?: string }) {
  return (
    <footer className="relative mt-16 text-paper">
      <img
        src="/art/meadow.jpg"
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover object-[center_58%]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-overlay/92 via-overlay/70 to-overlay/45" />
      <div className="relative mx-auto grid max-w-[1120px] gap-10 px-5 pt-14 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-serif text-2xl">WhoFundsOSS</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-paper/85">
            A public record of who funds open source. Amounts are a floor: only dollars someone has
            already published. Refreshed once a month.
          </p>
        </div>
        <FooterColumn
          title="Explore"
          links={[
            { to: "/ranking", label: "Ranking" },
            { to: "/movements", label: "Movements" },
            { to: "/graph", label: "Graph" },
          ]}
        />
        <FooterColumn
          title="Understand"
          links={[
            { to: "/method", label: "Method" },
            { to: "/mysteries", label: "Mysteries" },
            { to: "/watchlist", label: "Watchlist" },
            { to: "/denylist", label: "Spam denylist" },
          ]}
        />
      </div>
      <div className="relative mx-auto flex max-w-[1120px] flex-wrap gap-x-6 gap-y-2 px-5 pt-12 pb-8 text-sm text-paper/90">
        <span>© {collectedAt?.slice(0, 4) ?? "2026"} WhoFundsOSS</span>
        {collectedAt ? <span>Data collected {collectedLabel(collectedAt)}</span> : null}
        {hash ? <span className="tabular-nums">Snapshot {hashShort(hash)}</span> : null}
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <p className="text-sm font-semibold tracking-wide text-paper/70 uppercase">{title}</p>
      <ul className="mt-3 space-y-1">
        {links.map((item) => (
          <li key={item.to}>
            <Link to={item.to} className="inline-flex min-h-11 items-center text-lg hover:underline">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
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
    <header className="mx-auto max-w-[1120px] px-5 pt-8 pb-8 sm:pt-12">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-[1.08] tracking-tight sm:text-5xl">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-secondary">{lede}</p>
    </header>
  );
}
