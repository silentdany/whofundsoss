/**
 * Analytics consent (opt-in). PostHog is not loaded until the visitor says yes.
 * Pure module so node:test can cover it; the React side lives in
 * `components/analytics-consent.tsx`.
 */
export const CONSENT_STORAGE_KEY = "wfo.analytics-consent";

export type Consent = "granted" | "denied";
export type ConsentState = Consent | "unset";

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem" | "removeItem">;

export function readConsent(storage: ReadableStorage | null | undefined): ConsentState {
  try {
    const value = storage?.getItem(CONSENT_STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : "unset";
  } catch {
    // Storage blocked (privacy mode, sandboxed iframe): treat as no answer yet.
    return "unset";
  }
}

export function writeConsent(storage: WritableStorage | null | undefined, value: ConsentState): void {
  try {
    if (value === "unset") storage?.removeItem(CONSENT_STORAGE_KEY);
    else storage?.setItem(CONSENT_STORAGE_KEY, value);
  } catch {
    // Storage blocked: the choice holds for this page view only.
  }
}

/** Only an explicit yes, with a configured project, starts PostHog. */
export function shouldLoadAnalytics(consent: ConsentState, key?: string, host?: string): boolean {
  return consent === "granted" && Boolean(key) && Boolean(host);
}

/** The banner shows only on the client, once storage was read, and only with no answer. */
export function shouldShowBanner(consent: ConsentState | "pending", analyticsConfigured: boolean): boolean {
  return analyticsConfigured && consent === "unset";
}
