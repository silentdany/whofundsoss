import { createFileRoute } from "@tanstack/react-router";
import { authorize, csv } from "@/lib/http";

export const Route = createFileRoute("/api/v1/export/sponsorships")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = authorize(request);
        if (denied) return denied;
        const { sponsorshipsCsv } = await import("@/lib/catalog.server");
        return csv(sponsorshipsCsv(), "sponsorships.csv");
      },
    },
  },
});
