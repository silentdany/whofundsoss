import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { LoggerProvider, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { env } from "@/lib/env.server";

const posthogToken = env("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN");
const posthogHost = env("VITE_PUBLIC_POSTHOG_HOST");

if (process.env.NODE_ENV !== "production" && !posthogToken) {
  throw new Error(
    "VITE_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
  );
}

if (process.env.NODE_ENV !== "production" && !posthogHost) {
  throw new Error(
    "VITE_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_PUBLIC_POSTHOG_HOST is configured",
  );
}

const loggerProvider = posthogToken && posthogHost
  ? new LoggerProvider({
      processors: [
        new SimpleLogRecordProcessor({
          exporter: new OTLPLogExporter({
            url: new URL("/i/v1/logs", posthogHost).toString(),
            headers: { Authorization: `Bearer ${posthogToken}` },
          }),
        }),
      ],
    })
  : null;
const logger = loggerProvider?.getLogger("whofundsoss.posthog-export");

/**
 * Emits only instrumentation-owned operational lines to the dedicated PostHog
 * OTLP exporter. It deliberately does not attach to console or app loggers.
 */
export async function logPostHogInfo(message: string, attributes?: Record<string, string | number | boolean>) {
  if (!logger || !loggerProvider) return;
  logger.emit({
    severityText: "INFO",
    body: message,
    attributes,
  });
  await loggerProvider.forceFlush().catch(() => {});
}
