import { createFileRoute } from "@tanstack/react-router";
import { serveV1, json } from "@/lib/http";

export const Route = createFileRoute("/api/v1/watchlist/alerts")({
  server: {
    handlers: {
      GET: ({ request }) =>
        serveV1(request, async () => {
          const { alertsPayload } = await import("@/lib/catalog.server");
          return json(alertsPayload(new URL(request.url).searchParams));
        }),
    },
  },
});
