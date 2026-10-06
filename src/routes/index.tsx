import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { RankTable } from "@/components/rank-table";
import { Shell } from "@/components/shell";
import { money, collectedLabel } from "@/lib/format";
import { loadHome } from "@/lib/queries";
import { SOURCE_LABEL } from "@/lib/types";
import { datasetJsonLd, pageHead } from "@/lib/seo";
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_TAGLINE, TITLE_SEPARATOR } from "@/lib/site";

export const Route = createFileRoute("/")({
  loader: () => loadHome(),
  head: ({ loaderData }) =>
    pageHead({
      path: "/",
      title: `${SITE_NAME}${TITLE_SEPARATOR}${SITE_TAGLINE}`,
      description: DEFAULT_DESCRIPTION,
      jsonLd: loaderData ? [datasetJsonLd(loaderData.meta)] : [],
    }),
  component: Home,
});

function Home() {
  const data = Route.useLoaderData();
  const { meta } = data;
  const leader = data.top[0];

  return (
    <Shell collectedAt={meta.collectedAt} hash={meta.hash}>
      <section className="relative">
        <img
          src="/art/hero.jpg"
          alt=""
          className="h-[52vh] min-h-[320px] w-full object-cover object-[center_62%] sm:h-[64vh]"
        />
        {leader ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center px-5">
            <Link
              to="/company/$slug"
              params={{ slug: leader.slug }}
              className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-overlay/80 px-4 py-2 text-sm text-paper backdrop-blur-sm"
            >
              <span className="size-2 rounded-[2px] bg-sage-soft" aria-hidden="true" />
              {leader.name}: {money(leader.publicUsd)} public floor
              <span aria-hidden="true">›</span>
            </Link>
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center px-5">
            <Link
              to="/method"
              className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-overlay/80 px-4 py-2 text-sm text-paper backdrop-blur-sm"
            >
              <span className="size-2 rounded-[2px] bg-sage-soft" aria-hidden="true" />
              Snapshot · {collectedLabel(meta.collectedAt)}
            </Link>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-[1120px] px-5 pt-10 pb-4 sm:pt-16">
        <h1 className="max-w-4xl font-serif text-[2.85rem] leading-[1.02] tracking-tight sm:text-7xl">
          Who really funds open source.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-secondary">
          A row starts at zero. Only a published dollar moves it: a pledge, a collective, a GitHub
          tier you can actually see. WhoFundsOSS reads the public record once a month. It does not guess.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <a
            href="#brief"
            className="inline-flex min-h-12 items-center rounded-full bg-ink px-7 text-sm font-medium text-paper"
          >
            Read this month
          </a>
          <Link to="/ranking" className="text-sm font-medium text-sage">
            See the ranking
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1120px] grid-cols-3 gap-4 px-5 py-14 sm:py-20">
        <Stat value={money(meta.publicUsdRanked)} label="Public floor, top 200" />
        <Stat value={String(meta.ranked)} label="Companies ranked" />
        <Stat value={String(meta.companies)} label="In the file, after filters" />
      </section>

      <div className="mx-auto max-w-[1120px] px-5">
        <div className="h-px bg-line" />
      </div>

      <Chapters />

      <section id="brief" className="mx-auto max-w-[1120px] scroll-mt-20 px-5 py-16">
        <p className="text-sm text-muted">This collection · not a delta</p>
        <h2 className="mt-3 max-w-2xl font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
          What the snapshot can actually say.
        </h2>
        <ol className="mt-8 divide-y divide-line border-y border-line">
          {data.brief.map((line, index) => (
            <li key={line.title}>
              {line.slug ? (
                <Link
                  to="/company/$slug"
                  params={{ slug: line.slug }}
                  className="grid gap-2 py-6 sm:grid-cols-[4rem_1fr] sm:gap-6"
                >
                  <BriefBody index={index} title={line.title} text={line.text} />
                </Link>
              ) : (
                <Link to="/mysteries" className="grid gap-2 py-6 sm:grid-cols-[4rem_1fr] sm:gap-6">
                  <BriefBody index={index} title={line.title} text={line.text} />
                </Link>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-[1120px] pb-6">
        <div className="flex items-end justify-between px-5 pb-4">
          <h2 className="font-serif text-3xl tracking-tight">Top 10 companies funding open source</h2>
          <Link to="/ranking" className="text-sm text-sage">
            See all
          </Link>
        </div>
        <RankTable rows={data.top} />
      </section>

      <section className="mx-auto grid max-w-[1120px] gap-4 px-5 py-14 sm:grid-cols-2">
        <ReadingCard leader={leader?.name ?? "Posit"} />
        <div className="flex flex-col justify-between rounded-card bg-sand p-5 sm:p-8">
          <div>
            <p className="text-sm text-muted">Four sources. No invention.</p>
            <h2 className="mt-3 font-serif text-3xl leading-tight tracking-tight">
              Hidden GitHub tiers stay hidden.
            </h2>
            <p className="mt-4 leading-relaxed text-secondary">
              A monthly amount is never annualized. A private sponsorship never becomes a guess.
              The same pledge dollar is not counted again as an own program.
            </p>
          </div>
          <ul className="mt-8 grid grid-cols-2 gap-4">
            {data.mix.map((item) => (
              <li key={item.key}>
                <p className="font-serif text-3xl tabular-nums">{item.companies}</p>
                <p className="text-sm text-secondary">{SOURCE_LABEL[item.key]}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-5 pb-6">
        <FileChecks />
      </section>

      <section className="relative mt-8 overflow-hidden">
        <img src="/art/sky.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-overlay/30" />
        <div className="relative mx-auto max-w-[1120px] px-5 py-24 text-center sm:py-32">
          <p className="inline-flex items-center gap-2 rounded-full bg-paper/20 px-3 py-1.5 text-sm text-paper backdrop-blur-sm">
            <span className="size-2 rounded-[2px] bg-sage-soft" aria-hidden="true" />
            Limits, in one breath
          </p>
          <h2 className="mx-auto mt-6 max-w-xl font-serif text-4xl leading-[1.05] tracking-tight text-paper sm:text-6xl">
            The amount you can see is not the amount that moved.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-paper/90">
            {money(meta.publicUsdRanked)} across the top 200 is a floor. Spam and one self-fund were
            taken out before this file was published.
          </p>
          <Link
            to="/method"
            className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-paper px-6 text-sm font-medium text-ink"
          >
            Read the method
            <span aria-hidden="true">›</span>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-5 py-12">
        <p className="max-w-2xl text-sm leading-relaxed text-secondary">
          {data.featured
            ? `Featured record this collection: ${data.featured.name}. A featured line is labeled. It does not move a rank. `
            : null}
          Featured placement is $199–399 for 7 days. A sponsoring audit is $490 or $990. Neither
          writes a number that was not already public.
        </p>
      </section>
    </Shell>
  );
}

const CHAPTERS = [
  {
    title: "A row starts at zero",
    text: "Once a month WhoFundsOSS keeps what a company has already published: a pledge, a collective total, a visible GitHub tier, or a number on their own page.",
  },
  {
    title: "Two collections, then a move",
    text: "Rank, dollars, and project counts move only after a second snapshot exists. Until then this month is the floor, not a forecast.",
  },
  {
    title: "Who shares the work",
    text: "Companies that share distinctive projects sit on the graph. Mega-collectives everyone funds are left out, so the picture is not a knot.",
  },
] as const;

function Chapters() {
  const [open, setOpen] = useState(0);

  return (
    <section className="mx-auto max-w-[1120px] px-5">
      <ul>
        {CHAPTERS.map((chapter, index) => {
          const isOpen = open === index;
          return (
            <li key={chapter.title} className="border-b border-line">
              <button
                type="button"
                className="flex w-full items-start gap-4 py-7 text-left"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? -1 : index)}
              >
                <ChapterIcon index={index} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xl font-medium tracking-tight">{chapter.title}</span>
                  {isOpen ? (
                    <span className="mt-3 block max-w-xl text-base leading-relaxed text-secondary">
                      {chapter.text}
                    </span>
                  ) : null}
                </span>
                <span
                  className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-lg leading-none"
                  aria-hidden="true"
                >
                  {isOpen ? "−" : "+"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ChapterIcon({ index }: { index: number }) {
  const common = "mt-1 size-7 shrink-0 text-ink";
  if (index === 0) {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 15v-3M12 15V9M17 15v-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden="true">
        <path d="M7 7h11M7 12h11M7 17h7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M4 7h.01M4 12h.01M4 17h.01" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={common} aria-hidden="true">
      <circle cx="7" cy="12" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="7" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="17" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 11.2 15 8.2M9 12.8l6 3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function ReadingCard({ leader }: { leader: string }) {
  return (
    <div className="rounded-card bg-sand p-5 sm:p-8">
      <div className="rounded-3xl bg-sand px-2 py-4 sm:px-6">
        <p className="text-xs text-muted">Company search</p>
        <div className="mt-2 flex min-h-12 items-center gap-2 rounded-2xl border border-sage bg-paper px-4">
          <svg viewBox="0 0 24 24" className="size-4 text-muted" aria-hidden="true">
            <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M16 16l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span className="font-medium">{leader}</span>
        </div>
        <div className="flex justify-center py-2 text-muted" aria-hidden="true">
          ↓
        </div>
        <FlowStep title="Open Source Pledge" note="Annual report · labeled" />
        <div className="flex justify-center py-2 text-muted" aria-hidden="true">
          ↓
        </div>
        <FlowStep title="Open Collective" note="Cumulative total · labeled" />
      </div>
    </div>
  );
}

function FlowStep({ title, note }: { title: string; note: string }) {
  return (
    <div>
      <div className="flex min-h-12 items-center gap-3 rounded-2xl bg-paper px-4 shadow-sm">
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
          <path
            d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5 4.2 16.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <span className="font-medium">{title}</span>
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 pl-1 text-sm text-rise">
        <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true">
          <path d="M5 12.5 10 17l9-10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {note}
      </p>
    </div>
  );
}

const CHECKS = [
  { label: "Public dollar amount", on: true },
  { label: "Named projects", on: false },
  { label: "Source of the figure", on: true },
  { label: "What stayed private", on: false },
] as const;

function FileChecks() {
  return (
    <div className="rounded-card bg-sand px-4 py-8 sm:px-10">
      <ul className="mx-auto max-w-md -space-y-3">
        {CHECKS.map((item, index) => (
          <li
            key={item.label}
            className={`flex items-center gap-3 rounded-2xl bg-paper px-4 py-4 shadow-sm ${
              index % 2 === 0 ? "-rotate-1" : "rotate-1"
            }`}
          >
            <span
              className={
                item.on
                  ? "flex size-5 items-center justify-center rounded-full bg-ink text-paper"
                  : "size-5 rounded-full border border-line"
              }
              aria-hidden="true"
            >
              {item.on ? (
                <svg viewBox="0 0 24 24" className="size-3">
                  <path d="M5 12.5 10 17l9-10" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </span>
            <span className={item.on ? "font-medium" : "text-secondary"}>{item.label}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 rounded-2xl bg-paper/80 p-5">
        <p className="text-lg font-medium">A line has to earn its number.</p>
        <p className="mt-2 leading-relaxed text-secondary">
          If the tier is hidden, the row stays at zero. The dollar does not. Cumulative gifts stay
          marked cumulative. Nothing here is annualized to look larger.
        </p>
      </div>
    </div>
  );
}

function BriefBody({ index, title, text }: { index: number; title: string; text: string }) {
  return (
    <>
      <span className="text-sm text-muted tabular-nums">0{index + 1}</span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="mt-1 block max-w-2xl leading-relaxed text-secondary">{text}</span>
      </span>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-3xl font-semibold tracking-tight tabular-nums sm:text-5xl">{value}</p>
      <p className="mt-2 text-sm leading-snug text-secondary">{label}</p>
    </div>
  );
}
