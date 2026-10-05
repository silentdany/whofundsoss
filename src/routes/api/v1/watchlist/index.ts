import { createFileRoute } from "@tanstack/react-router";
import { authorize, json } from "@/lib/http";

export const Route = createFileRoute("/api/v1/watchlist/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = authorize(request);
        if (denied) return denied;
        const { watchlistApi } = await import("@/lib/catalog.server");
        return json(watchlistApi());
      },
    },
  },
});
