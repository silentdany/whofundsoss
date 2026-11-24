/** Client-side consent store shared by the banner and the privacy page. */
import { useSyncExternalStore } from "react";
import { readConsent, writeConsent, type ConsentState } from "./analytics-consent";

const listeners = new Set<() => void>();

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

let memoryConsent: ConsentState | null = null;

function snapshot(): ConsentState {
  return memoryConsent ?? readConsent(browserStorage());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Record the visitor's choice (banner, or the privacy page's "change" button). */
export function setAnalyticsConsent(value: ConsentState) {
  memoryConsent = value;
  writeConsent(browserStorage(), value);
  for (const listener of listeners) listener();
}

/** "pending" during SSR and hydration, so the banner never flashes server-side. */
export function useAnalyticsConsent(): ConsentState | "pending" {
  return useSyncExternalStore(subscribe, snapshot, () => "pending" as const);
}
