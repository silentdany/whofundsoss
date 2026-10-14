import { createFileRoute } from "@tanstack/react-router";
import { serveV1, json } from "@/lib/http";

export const Route = createFileRoute("/api/v1/watchlist/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        serveV1(request, async () => {
          const { watchlistApi } = await import("@/lib/catalog.server");
          return json(watchlistApi());
        }),
    },
  },
});
