import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { clearPostHogStorage, shouldLoadAnalytics, shouldShowBanner } from "@/lib/analytics-consent";
import { setAnalyticsConsent, useAnalyticsConsent } from "@/lib/analytics-consent-store";

/**
 * Wraps the app in PostHog's context without starting it. `posthog.init` runs
 * only after an explicit yes; a later no opts out and clears PostHog storage.
 */
export function ConsentedAnalytics({
  apiKey,
  host,
  children,
}: {
  apiKey?: string;
  host?: string;
  children: ReactNode;
}) {
  const consent = useAnalyticsConsent();
  const started = useRef(false);

  useEffect(() => {
    if (consent === "pending") return;
    if (shouldLoadAnalytics(consent, apiKey, host)) {
      if (!started.current) {
        posthog.init(apiKey as string, {
          api_host: host,
          defaults: "2025-05-24",
          capture_exceptions: true,
          // No session replay, whatever the PostHog project setting says.
          disable_session_recording: true,
          debug: import.meta.env.DEV,
          tracing_headers: [window.location.hostname],
        });
        started.current = true;
        // A previous "no" leaves PostHog's own opt-out flag; a new "yes" lifts it.
        if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing();
      } else {
        posthog.set_config({ disable_persistence: false });
        posthog.opt_in_capturing();
      }
      return;
    }
    if (started.current) {
      // Forget the identifier first: reset() also clears the opt-out flag, so
      // it must run BEFORE opt_out_capturing(). Then stop capturing (writes
      // PostHog's opt-out marker) and stop persisting (drops its cookie and
      // localStorage entry).
      posthog.reset(true);
      posthog.opt_out_capturing();
      posthog.set_config({ disable_persistence: true });
    }
    // No (or no longer a) yes: delete whatever PostHog stored, including what an
    // earlier, now expired, yes left behind. Only the "no" markers stay:
    // PostHog's opt-out flag and our CONSENT_STORAGE_KEY.
    clearPostHogStorage(document, window.location.hostname, [safeStorage("local"), safeStorage("session")]);
  }, [consent, apiKey, host]);

  return (
    <PostHogProvider client={posthog}>
      {children}
      <ConsentBanner configured={Boolean(apiKey && host)} />
    </PostHogProvider>
  );
}

function safeStorage(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function ConsentBanner({ configured }: { configured: boolean }) {
  const consent = useAnalyticsConsent();
  if (!shouldShowBanner(consent, configured)) return null;

  return (
    <div
      role="region"
      aria-label="Analytics choice"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-xl rounded-2xl border border-line bg-paper p-5 text-ink shadow-lg sm:bottom-5"
    >
      <p className="text-sm leading-relaxed">
        Can we count visits with PostHog analytics? Nothing is loaded until you choose, and you can
        change your mind on the{" "}
        <Link to="/privacy" className="underline underline-offset-2">
          privacy page
        </Link>
        .
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAnalyticsConsent("denied")}
          className="inline-flex min-h-11 items-center rounded-full bg-sand px-5 text-sm font-medium hover:bg-line"
        >
          No thanks
        </button>
        <button
          type="button"
          onClick={() => setAnalyticsConsent("granted")}
          className="inline-flex min-h-11 items-center rounded-full bg-sand px-5 text-sm font-medium hover:bg-line"
        >
          Allow analytics
        </button>
      </div>
    </div>
  );
}
