import { createFileRoute } from "@tanstack/react-router";
import { serveV1, json } from "@/lib/http";

export const Route = createFileRoute("/api/v1/graph/co-sponsorships")({
  server: {
    handlers: {
      GET: ({ request }) =>
        serveV1(request, async () => {
          const { graphQuery } = await import("@/lib/catalog.server");
          return json(graphQuery(new URL(request.url).searchParams));
        }),
    },
  },
});
