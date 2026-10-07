import { createFileRoute, Link } from "@tanstack/react-router";
import { CompanySearch } from "@/components/company-search";
import { RankTable } from "@/components/rank-table";
import { Shell } from "@/components/shell";
import { money, collectedLabel } from "@/lib/format";
import { loadHome } from "@/lib/queries";
import { SOURCE_LABEL, SOURCE_ORDER } from "@/lib/types";
import { datasetJsonLd, pageHead } from "@/lib/seo";
import { DEFAULT_DESCRIPTION, PAGE_TITLES } from "@/lib/site";

export const Route = createFileRoute("/")({
  loader: () => loadHome(),
  head: ({ loaderData }) =>
    pageHead({
      path: "/",
      title: PAGE_TITLES.home,
      description: DEFAULT_DESCRIPTION,
      jsonLd: loaderData ? [datasetJsonLd(loaderData.meta)] : [],
    }),
  component: Home,
});

function Home() {
  const data = Route.useLoaderData();
  const { meta } = data;
  
  return (
    <Shell collectedAt={meta.collectedAt} hash={meta.hash}>
      <section className="relative">
        <div className="relative h-[220px] sm:h-[300px] lg:h-[340px]">
          <img src="/art/hero.jpg" alt="" className="absolute inset-0 size-full object-cover object-[center_62%]" />
        </div>
        <div className="relative z-10 mx-auto -mt-24 w-full max-w-[1120px] px-5 sm:-mt-28">
          <div className="rounded-[1.75rem] bg-paper px-6 py-8 shadow-[0_22px_50px_-20px_rgba(28,92,86,0.55)] sm:px-10 sm:py-10">
            <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-14">
              <div>
            <p className="eyebrow">Public record · {collectedLabel(meta.collectedAt)}</p>
            <h1 className="mt-3 max-w-3xl font-serif text-[2.3rem] leading-[1.05] tracking-tight sm:text-6xl">
              Who really funds open source.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-secondary sm:text-lg">
              Which companies put real money into open source, and how much? We read what they have publicly pledged or donated, once a month, and count only
              the dollars someone actually published. No estimates, no guesses.
            </p>
            <div className="mt-7 max-w-xl">
              <CompanySearch placeholder="Look up a company" />
              <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-secondary">
                <span>or</span>
                <Link to="/ranking" className="font-medium text-sage underline-offset-4 hover:underline">
                  Browse the full ranking
                </Link>
              </p>
            </div>
              </div>
              <aside aria-label="Current top three" className="hidden lg:block">
                <p className="eyebrow">Leading right now</p>
                <ol className="mt-4 divide-y divide-line rounded-2xl border border-line">
                  {data.top.slice(0, 3).map((row) => (
                    <li key={row.slug}>
                      <Link
                        to="/company/$slug"
                        params={{ slug: row.slug }}
                        className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-sand/70"
                      >
                        <span className="w-5 font-serif text-xl text-muted tabular-nums">{row.rank}</span>
                        <span className="flex-1 font-medium">{row.name}</span>
                        <span className="font-semibold tabular-nums">{money(row.publicUsd)}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
                <Link to="/ranking" className="mt-3 inline-block text-sm font-medium text-sage">
                  See the other {meta.ranked - 3} <span aria-hidden="true">›</span>
                </Link>
              </aside>
            </div>
            <dl className="mt-8 grid grid-cols-3 gap-x-4 gap-y-3 border-t border-line pt-6">
              <Stat value={money(meta.publicUsdRanked)} label={`Public funding found across the top ${meta.ranked}`} />
              <Stat value={String(meta.ranked)} label="Companies ranked" />
              <Stat value={String(meta.companies)} label="Companies tracked in total" />
            </dl>
          </div>
        </div>
      </section>

      <HowItWorks />

      <section id="brief" className="mx-auto max-w-[1120px] scroll-mt-20 px-5 py-16">
        <p className="eyebrow">This month in short</p>
        <h2 className="mt-3 max-w-2xl font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
          What stands out in this snapshot.
        </h2>
        <ol className="mt-8 divide-y divide-line border-y border-line">
          {data.brief.map((line, index) => (
            <li key={line.title}>
              {line.slug ? (
                <Link
                  to="/company/$slug"
                  params={{ slug: line.slug }}
                  className="group grid grid-cols-[2.5rem_1fr_auto] items-start gap-3 py-6 transition-colors hover:bg-sand/60 sm:grid-cols-[4rem_1fr_auto] sm:gap-6"
                >
                  <BriefBody index={index} title={line.title} text={line.text} />
                </Link>
              ) : (
                <Link
                  to="/mysteries"
                  className="group grid grid-cols-[2.5rem_1fr_auto] items-start gap-3 py-6 transition-colors hover:bg-sand/60 sm:grid-cols-[4rem_1fr_auto] sm:gap-6"
                >
                  <BriefBody index={index} title={line.title} text={line.text} />
                </Link>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-[1120px] pb-6">
        <div className="flex items-end justify-between gap-4 px-5 pb-4">
          <h2 className="font-serif text-3xl tracking-tight">Top 10 companies funding open source</h2>
          <Link to="/ranking" className="shrink-0 text-sm font-medium text-sage">
            See all {meta.ranked} <span aria-hidden="true">›</span>
          </Link>
        </div>
        <RankTable rows={data.top} />
      </section>

      <section className="mx-auto max-w-[1120px] px-5 py-16">
        <p className="eyebrow">Where the numbers come from</p>
        <h2 className="mt-3 max-w-2xl font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
          Four public sources. Nothing invented.
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {SOURCE_ORDER.map((key) => {
            const item = data.mix.find((entry) => entry.key === key);
            return (
              <li key={key} className="rounded-card bg-sand p-6">
                <p className="font-serif text-4xl tabular-nums">{item?.companies ?? 0}</p>
                <p className="mt-1 text-sm text-secondary">companies appear in</p>
                <h3 className="mt-3 text-lg font-semibold">{SOURCE_LABEL[key]}</h3>
                <p className="mt-1 text-sm leading-relaxed text-secondary">{SOURCE_BLURB[key]}</p>
              </li>
            );
          })}
        </ul>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-card border border-line p-6">
            <h3 className="font-semibold text-rise">What we count</h3>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-secondary">
              <li>A published amount: a pledge, a collective total, a GitHub tier you can see.</li>
              <li>Each dollar once. A pledge repeated as an own program is not counted twice.</li>
            </ul>
          </div>
          <div className="rounded-card border border-line p-6">
            <h3 className="font-semibold text-fall">What we never do</h3>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-secondary">
              <li>Guess a hidden GitHub tier. If the amount is private, the row stays at zero.</li>
              <li>Multiply a monthly amount by twelve. Cumulative gifts stay labeled cumulative.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden">
        <img src="/art/sky.jpg" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-overlay/45" />
        <div className="relative mx-auto max-w-[1120px] px-5 py-20 text-center sm:py-28">
          <p className="inline-flex items-center gap-2 rounded-full bg-paper/20 px-3 py-1.5 text-sm text-paper backdrop-blur-sm">
            Good to know before you quote a number
          </p>
          <h2 className="mx-auto mt-6 max-w-2xl font-serif text-4xl leading-[1.05] tracking-tight text-paper sm:text-5xl">
            The amount you can see is not the amount that moved.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-paper/95">
            {money(meta.publicUsdRanked)} across the top {meta.ranked} is a floor. Spam and one self-funded
            collective were taken out before this file was published.
          </p>
          <Link
            to="/method"
            className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-paper px-6 text-sm font-medium text-ink"
          >
            Read how we count
            <span aria-hidden="true">›</span>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-5 py-12">
        <h2 className="text-sm font-semibold text-ink">About paid placements</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">
          {data.featured
            ? `This collection's featured company is ${data.featured.name}. A featured line is always labeled and never changes a rank. `
            : null}
          Featured placement costs $199 to $399 for 7 days, and a sponsored audit $490 or $990.
          Neither can add a number that was not already public.
        </p>
      </section>
    </Shell>
  );
}

const SOURCE_BLURB = {
  oc: "Donations to open source collectives. Totals are cumulative, often over several years.",
  osp: "A yearly commitment published by companies in the Open Source Pledge.",
  gh: "Sponsorships of maintainers. The amount only counts when the tier is public, which is rare.",
  own: "A figure the company publishes about its own open source fund or program.",
} as const;

const STEPS = [
  {
    title: "Find",
    text: "Once a month we collect every funding figure companies have published, from four public sources.",
  },
  {
    title: "Count",
    text: "Only published dollars count. A hidden amount stays at zero rather than becoming a guess.",
  },
  {
    title: "Compare",
    text: "Next month we collect again. Rank and dollars only move once a second snapshot exists.",
  },
] as const;

function HowItWorks() {
  return (
    <section className="mx-auto max-w-[1120px] px-5 pt-14">
      <h2 className="sr-only">How it works</h2>
      <ol className="grid gap-8 border-y border-line py-10 sm:grid-cols-3 sm:gap-10">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-soft font-serif text-lg text-sage"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-secondary">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function BriefBody({ index, title, text }: { index: number; title: string; text: string }) {
  return (
    <>
      <span className="pt-0.5 font-serif text-xl text-muted tabular-nums">0{index + 1}</span>
      <span>
        <span className="block text-lg font-semibold">{title}</span>
        <span className="mt-1 block max-w-2xl leading-relaxed text-secondary">{text}</span>
      </span>
      <span
        className="hidden pt-1 text-lg text-muted transition-transform group-hover:translate-x-1 group-hover:text-sage sm:block"
        aria-hidden="true"
      >
        ›
      </span>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col-reverse justify-end">
      <dt className="mt-1 text-xs leading-snug text-secondary sm:text-sm">{label}</dt>
      <dd className="text-2xl font-semibold tracking-tight tabular-nums sm:text-4xl">{value}</dd>
    </div>
  );
}
