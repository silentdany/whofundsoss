import type { ErrorComponentProps } from "@tanstack/react-router";
import * as Sentry from "@sentry/tanstackstart-react";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const posthog = usePostHog();

  useEffect(() => {
    Sentry.captureException(error);
    posthog?.captureException(error);
  }, [error, posthog]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas px-6 text-center text-ink">
      <span className="text-fall" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={1.75} />
      </span>
      <h1 className="font-serif text-2xl">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-secondary">{errorMessage(error)}</p>
    </main>
  );
}
