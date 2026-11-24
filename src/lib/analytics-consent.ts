/**
 * Analytics consent (opt-in). PostHog is not loaded until the visitor says yes.
 * Pure module so node:test can cover it; the React side lives in
 * `components/analytics-consent.tsx`.
 */
export const CONSENT_STORAGE_KEY = "wfo.analytics-consent";

export type Consent = "granted" | "denied";
export type ConsentState = Consent | "unset";

/** A choice is kept 6 months, then the banner asks again. */
export const CONSENT_MAX_AGE_MONTHS = 6;

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem" | "removeItem">;
type StoredConsent = { choice: Consent; at: string };

/** True once `months` calendar months have passed since `at`. */
export function consentExpired(at: Date, now: Date, months = CONSENT_MAX_AGE_MONTHS): boolean {
  const limit = new Date(at.getTime());
  limit.setUTCMonth(limit.getUTCMonth() + months);
  return now.getTime() >= limit.getTime();
}

/** Stored as `{"choice":"granted"|"denied","at":ISO date}`; anything else, or an expired choice, is unset. */
export function readConsent(storage: ReadableStorage | null | undefined, now: Date = new Date()): ConsentState {
  let raw: string | null | undefined;
  try {
    raw = storage?.getItem(CONSENT_STORAGE_KEY);
  } catch {
    // Storage blocked (privacy mode, sandboxed iframe): treat as no answer yet.
    return "unset";
  }
  if (!raw) return "unset";
  try {
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    if (parsed.choice !== "granted" && parsed.choice !== "denied") return "unset";
    const at = new Date(String(parsed.at));
    if (Number.isNaN(at.getTime()) || at.getTime() > now.getTime()) return "unset";
    return consentExpired(at, now) ? "unset" : parsed.choice;
  } catch {
    return "unset";
  }
}

export function writeConsent(
  storage: WritableStorage | null | undefined,
  value: ConsentState,
  now: Date = new Date(),
): void {
  try {
    if (value === "unset") storage?.removeItem(CONSENT_STORAGE_KEY);
    else storage?.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ choice: value, at: now.toISOString() } satisfies StoredConsent));
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
