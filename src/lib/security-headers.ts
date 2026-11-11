/**
 * Content-Security-Policy, built from what the pages actually load:
 * - own assets; TanStack Start SSR inline hydration scripts ('unsafe-inline';
 *   a per-request nonce is the follow-up, see the PR #44 Sécu report);
 * - the Grok branding script, by path only (AGENTS.md rule 2: never block it);
 * - PostHog EU only (scripts from eu-assets, events to eu.i);
 * - Google Fonts; Sentry (DE ingest);
 * - images: own files, data: and blob: only.
 * Vercel Live (preview comments toolbar, with its Pusher socket) is allowed on
 * preview deployments only, never in production.
 * frame-ancestors: the site and the Grok embedder (PreviewHostBridge,
 * AGENTS.md rule 3), the same allowlist as preview-embedder-origin.ts.
 */
export const POSTHOG_EU_API_HOST = "https://eu.i.posthog.com";
export const POSTHOG_EU_ASSETS_HOST = "https://eu-assets.i.posthog.com";
export const POSTHOG_EU_UI_HOST = "https://eu.posthog.com";

export function buildCsp({ preview }: { preview: boolean }): string {
  const live = preview ? ["https://vercel.live"] : [];
  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    ["base-uri", ["'self'"]],
    ["object-src", ["'none'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'self'", "https://grok.com", "https://*.grok.com"]],
    ["script-src", ["'self'", "'unsafe-inline'", "https://grok.com/grok-app-builder/", POSTHOG_EU_ASSETS_HOST, ...live]],
    ["style-src", ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", ...live]],
    ["font-src", ["'self'", "data:", "https://fonts.gstatic.com", ...(preview ? ["https://vercel.live", "https://assets.vercel.com"] : [])]],
    ["img-src", ["'self'", "data:", "blob:", ...(preview ? ["https://vercel.live", "https://vercel.com"] : [])]],
    [
      "connect-src",
      [
        "'self'",
        "https://*.ingest.de.sentry.io",
        POSTHOG_EU_API_HOST,
        POSTHOG_EU_ASSETS_HOST,
        "https://grok.com",
        "https://*.grok.com",
        ...(preview ? ["https://vercel.live", "wss://ws-us3.pusher.com"] : []),
      ],
    ],
    ["frame-src", preview ? ["https://vercel.live"] : ["'none'"]],
    ["worker-src", ["'self'", "blob:"]],
    ["manifest-src", ["'self'"]],
    ["upgrade-insecure-requests", []],
  ];
  return directives.map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k)).join("; ");
}

/** Production = Vercel production; everything else (previews, local) is preview. */
export function isPreviewEnv(vercelEnv: string | undefined): boolean {
  return vercelEnv !== "production";
}

/** PostHog API host: the configured one only if it is the EU cloud, else EU. */
export function posthogEuHost(configured: string | undefined): string {
  try {
    const u = new URL(configured ?? "");
    if (u.protocol === "https:" && (u.hostname === "eu.i.posthog.com" || u.hostname === "eu.posthog.com")) {
      return `https://${u.hostname}`;
    }
  } catch {
    // fall through
  }
  return POSTHOG_EU_API_HOST;
}
