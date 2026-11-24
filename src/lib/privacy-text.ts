/**
 * /privacy text, word for word from the legal draft of 24/11/2026 (Fonts:
 * option A, self-hosted), with the bracket decisions of the same day. Values in [brackets] are still to confirm before
 * publication: keep PRIVACY_TEXT_PENDING true in routes/privacy.tsx until then.
 * The controller's identity and contact email proposed in the draft are kept
 * out of this public repo until confirmed; they replace the two placeholders.
 */
export type PrivacyBlock = { p: string } | { list: string[] };
export type PrivacySection = { title: string; blocks: PrivacyBlock[] };

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    title: "Who runs this site",
    blocks: [
      {
        p: 'WhoFundsOSS (whofundsoss.com) is run by [data controller name, to confirm], who decides how the data described here is used (the "data controller").',
      },
      {
        p: "Contact for anything about your data: [contact email, to confirm].",
      },
    ],
  },
  {
    title: "What we collect",
    blocks: [
      {
        p: "WhoFundsOSS has no accounts, no sign-in and no forms. We never ask for your name or email.",
      },
      {
        p: "The companies and amounts shown on the site come from figures those companies published themselves.",
      },
      {
        p: "The only data about you comes from your visit, as described below.",
      },
    ],
  },
  {
    title: "Analytics (PostHog), only with your consent",
    blocks: [
      {
        p: 'If you click "Allow analytics", we use PostHog to understand how the site is used:',
      },
      {
        list: [
          "pages you view and when you leave them;",
          "clicks on the page, and a few actions such as searching for a company, opening a company, the graph, the watchlist or the ranking;",
          "JavaScript errors you run into;",
          "a random identifier for your browser, and your IP address as seen by PostHog's servers.",
        ],
      },
      {
        p: "We use this to fix problems and decide what to improve. We do not use it for advertising and we do not sell it.",
      },
      {
        p: "PostHog stores this data in the EU (eu.i.posthog.com). We keep it for [12 months].",
      },
      {
        p: 'Legal basis: your consent. If you click "No thanks", or do nothing, PostHog is not loaded and nothing is sent.',
      },
      {
        p: 'You can change your mind at any time on this page with "Turn analytics off" or "Allow analytics". When you turn analytics off, PostHog stops collecting and deletes the identifier it stored in your browser. It keeps only a small marker that you said no.',
      },
      {
        p: "Our server also sends PostHog a short technical health message (counts of companies and fundings). It contains no data about visitors.",
      },
    ],
  },
  {
    title: "Hosting and server logs (Vercel)",
    blocks: [
      {
        p: "The site is hosted by Vercel Inc. (USA). See Vercel's privacy policy: https://vercel.com/legal/privacy-policy.",
      },
      {
        p: "Like any web host, Vercel receives your IP address, the page requested and your browser type when you visit, to deliver the page and protect the site. Vercel shows us these logs for 1 day. Vercel may keep its own copies under its privacy policy.",
      },
      {
        p: "Legal basis: our legitimate interest in running a working and secure site.",
      },
      {
        p: "Vercel is a US company certified under the EU-U.S. Data Privacy Framework, and also uses the European Commission's standard contractual clauses where required.",
      },
      {
        p: "To protect the public API, we count requests per IP address (60 per minute). This count stays in memory for a minute and is never stored.",
      },
    ],
  },
  {
    title: "Error reports (Sentry)",
    blocks: [
      {
        p: "When something breaks on the site, in your browser or on our server, we send an error report to Sentry: the error message, where it happened in the code, the page address and your browser type.",
      },
      {
        p: "Our site does not send your IP address to Sentry.",
      },
      {
        p: "Sentry receives these reports in Germany (ingest.de.sentry.io). We keep them for [90 days].",
      },
      {
        p: "Legal basis: our legitimate interest in finding and fixing bugs. Sentry does not place cookies and is not used to follow you.",
      },
    ],
  },
  {
    title: "Fonts",
    blocks: [
      {
        p: "The fonts (Fraunces and Manrope) are served from our own site. Your browser does not contact Google to load them.",
      },
    ],
  },
  {
    title: "Cookies and local storage",
    blocks: [
      {
        list: [
          "wfo.analytics-consent (local storage): remembers whether you allowed analytics. Always set once you choose. Kept 6 months, then we ask again.",
          'PostHog cookie ph_..._posthog and PostHog local storage: only after you click "Allow analytics". They hold the random identifier. Removed when you turn analytics off.',
          "No login cookies and no advertising cookies.",
        ],
      },
    ],
  },
  {
    title: "Your rights and contact",
    blocks: [
      {
        p: "Under the GDPR you can ask to access, correct or delete data about you, object to its use, or ask us to limit it. Where we rely on your consent, you can withdraw it at any time on this page.",
      },
      {
        p: "Because we do not know who you are, we may need details from you (for example the date of your visit) to find your data.",
      },
      {
        p: "Write to [contact email, to confirm]. We answer within one month.",
      },
      {
        p: "If you are not satisfied, you can complain to the French data protection authority, the CNIL (https://www.cnil.fr), or to the authority in your country.",
      },
    ],
  },
];

export const PRIVACY_LAST_UPDATED = "Last updated: [date de mise en ligne]";
