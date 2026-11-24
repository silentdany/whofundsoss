import { createFileRoute } from "@tanstack/react-router";
import { PageIntro, Shell } from "@/components/shell";
import { setAnalyticsConsent, useAnalyticsConsent } from "@/lib/analytics-consent-store";
import { pageHead } from "@/lib/seo";
import { PAGE_TITLES } from "@/lib/site";

/**
 * Privacy page. The structure and the factual list of services are in place;
 * the legal text is pending (see privacy-facts.md in the PR). Kept noindex and
 * out of the sitemap until the final text lands. Do not merge with placeholders.
 */
export const PRIVACY_TEXT_PENDING = true;

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageHead({
      path: "/privacy",
      title: PAGE_TITLES.privacy,
      description: "How WhoFundsOSS handles visitor data: analytics only with consent, hosting, and error reports.",
      robots: "noindex",
    }),
  component: PrivacyPage,
});

const SECTIONS = [
  { id: "who", title: "Who runs this site" },
  { id: "data", title: "What we collect" },
  { id: "analytics", title: "Analytics (PostHog), only with your consent" },
  { id: "hosting", title: "Hosting and server logs (Vercel)" },
  { id: "errors", title: "Error reports (Sentry)" },
  { id: "fonts", title: "Fonts (Google Fonts)" },
  { id: "storage", title: "Cookies and local storage" },
  { id: "rights", title: "Your rights and contact" },
] as const;

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
            Draft: the legal text of this page is pending review. Sections below are placeholders.
          </p>
        ) : null}

        <section id="choice" className="mt-10 max-w-2xl">
          <h2 className="font-serif text-2xl">Your analytics choice</h2>
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

        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="mt-10 max-w-2xl">
            <h2 className="font-serif text-2xl">{section.title}</h2>
            <p className="mt-3 text-secondary">[Legal text pending.]</p>
          </section>
        ))}
      </div>
    </Shell>
  );
}
