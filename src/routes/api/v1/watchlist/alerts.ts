import { createFileRoute } from "@tanstack/react-router";
import { authorize, json } from "@/lib/http";

export const Route = createFileRoute("/api/v1/watchlist/alerts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = authorize(request);
        if (denied) return denied;
        const { alertsPayload } = await import("@/lib/catalog.server");
        return json(alertsPayload(new URL(request.url).searchParams));
      },
    },
  },
});
