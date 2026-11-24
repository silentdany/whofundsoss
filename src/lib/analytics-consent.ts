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

type CookieJar = { cookie: string };
type KeyedStorage = Pick<Storage, "removeItem"> & { readonly length: number; key(index: number): string | null };

/** PostHog's opt-out marker (`__ph_opt_in_out_<token>`): kept, it only says "no". */
export function isPostHogOptOutMarker(name: string): boolean {
  return name.startsWith("__ph_opt_in_out_");
}

/** PostHog keys to delete: `ph_<token>_posthog`, `ph_<token>_*`, `__ph_*`, `ph_debug`, but not the opt-out marker. */
export function isPostHogKey(name: string): boolean {
  return /^(__)?ph_/.test(name) && !isPostHogOptOutMarker(name);
}

/** `a.b.example.com` -> ["a.b.example.com", ".a.b.example.com", ".b.example.com", ".example.com"]. */
function cookieDomains(hostname: string): string[] {
  const labels = hostname.split(".");
  const domains = [hostname];
  for (let i = 0; i < labels.length - 1; i++) domains.push(`.${labels.slice(i).join(".")}`);
  return domains;
}

/**
 * Delete everything PostHog stored in this browser (cookies on this host and
 * its parent domains, localStorage, sessionStorage), except PostHog's opt-out
 * marker. The visitor's "no" is also kept in our own `CONSENT_STORAGE_KEY`.
 */
export function clearPostHogStorage(
  doc: CookieJar | null | undefined,
  hostname: string,
  stores: (KeyedStorage | null | undefined)[],
): string[] {
  const removed: string[] = [];
  if (doc) {
    const names = doc.cookie
      .split(";")
      .map((c) => c.split("=")[0]?.trim() ?? "")
      .filter(isPostHogKey);
    for (const name of names) {
      doc.cookie = `${name}=; Max-Age=0; path=/`;
      for (const domain of cookieDomains(hostname)) doc.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`;
      removed.push(`cookie:${name}`);
    }
  }
  for (const store of stores) {
    try {
      if (!store) continue;
      const keys: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (key && isPostHogKey(key)) keys.push(key);
      }
      for (const key of keys) {
        store.removeItem(key);
        removed.push(`storage:${key}`);
      }
    } catch {
      // Storage blocked: nothing PostHog could have written there either.
    }
  }
  return removed;
}
