import { Fragment, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageIntro, Shell } from "@/components/shell";
import { setAnalyticsConsent, useAnalyticsConsent } from "@/lib/analytics-consent-store";
import { PRIVACY_LAST_UPDATED, PRIVACY_SECTIONS } from "@/lib/privacy-text";
import { pageHead } from "@/lib/seo";
import { PAGE_TITLES } from "@/lib/site";

/**
 * Privacy page. Text from the legal draft (src/lib/privacy-text.ts). Pending
 * until the [bracketed] values are confirmed: kept noindex, out of the sitemap,
 * with a visible draft notice. Do not merge while this is true.
 */
export const PRIVACY_TEXT_PENDING = true;

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageHead({
      path: "/privacy",
      title: PAGE_TITLES.privacy,
      description: "How WhoFundsOSS handles visitor data: analytics only with consent, hosting, and error reports.",
      robots: PRIVACY_TEXT_PENDING ? "noindex" : undefined,
    }),
  component: PrivacyPage,
});

const TOKEN = /(\[[^\]]+\]|https:\/\/[^\s)]+[^\s).,])/g;

/** Plain text with links made clickable and [values to confirm] highlighted. */
function RichText({ text }: { text: string }): ReactNode {
  return text.split(TOKEN).map((part, i) => {
    if (part.startsWith("[") && part.endsWith("]")) {
      return (
        <mark key={i} className="rounded bg-amber-100 px-1 text-ink">
          {part}
        </mark>
      );
    }
    if (part.startsWith("https://")) {
      return (
        <a key={i} href={part} className="underline underline-offset-2" rel="noreferrer">
          {part}
        </a>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function PrivacyPage() {
  const consent = useAnalyticsConsent();

  return (
    <Shell>
      <PageIntro
        eyebrow="Privacy"
        title="Privacy"
        lede="What this site collects, why, and how to change your analytics choice."
      />
      <div className="mx-auto max-w-[1120px] px-5">
        {PRIVACY_TEXT_PENDING ? (
          <p role="note" className="max-w-2xl rounded-2xl bg-sand p-4 text-sm">
            Draft: values in brackets are still to be confirmed. This page is not final yet.
          </p>
        ) : null}

        <section id="choice" className="mt-10 max-w-2xl" aria-labelledby="choice-title">
          <h2 id="choice-title" className="font-serif text-2xl">
            Your analytics choice
          </h2>
          <p className="mt-3 text-secondary" aria-live="polite">
            {consent === "granted"
              ? "Analytics are on."
              : consent === "denied"
                ? "Analytics are off."
                : consent === "unset"
                  ? "You have not chosen yet. Analytics stay off until you do."
                  : "Loading your choice."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAnalyticsConsent("denied")}
              className="inline-flex min-h-11 items-center rounded-full bg-sand px-5 text-sm font-medium hover:bg-line"
            >
              Turn analytics off
            </button>
            <button
              type="button"
              onClick={() => setAnalyticsConsent("granted")}
              className="inline-flex min-h-11 items-center rounded-full bg-sand px-5 text-sm font-medium hover:bg-line"
            >
              Allow analytics
            </button>
          </div>
        </section>

        {PRIVACY_SECTIONS.map((section) => (
          <section key={section.title} id={slug(section.title)} className="mt-12 max-w-2xl">
            <h2 className="font-serif text-2xl">{section.title}</h2>
            {section.blocks.map((block, i) =>
              "p" in block ? (
                <p key={i} className="mt-3 leading-relaxed text-secondary">
                  <RichText text={block.p} />
                </p>
              ) : (
                <ul key={i} className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed text-secondary">
                  {block.list.map((item) => (
                    <li key={item}>
                      <RichText text={item} />
                    </li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}

        <p className="mt-12 max-w-2xl text-sm text-muted">
          <RichText text={PRIVACY_LAST_UPDATED} />
        </p>
      </div>
    </Shell>
  );
}
