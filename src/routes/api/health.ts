import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/http";
import { logPostHogInfo } from "@/lib/posthog-logs.server";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        await logPostHogInfo("health endpoint requested");

        const { getMeta } = await import("@/lib/catalog.server");
        const meta = getMeta();
        await logPostHogInfo("health endpoint served catalog metadata", {
          companies: meta.companies,
          sponsorships: meta.sponsorships,
        });

        return json({
          collected_at: meta.collectedAt,
          hash: meta.hash,
          companies: meta.companies,
          sponsorships: meta.sponsorships,
          ranked: meta.ranked,
          public_usd_ranked: meta.publicUsdRanked,
          public_usd_all: meta.publicUsdAll,
          cron: meta.cron,
        });
      },
    },
  },
});
