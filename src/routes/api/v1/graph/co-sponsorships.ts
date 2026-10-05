import { createFileRoute } from "@tanstack/react-router";
import { authorize, json } from "@/lib/http";

export const Route = createFileRoute("/api/v1/graph/co-sponsorships")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = authorize(request);
        if (denied) return denied;
        const { graphQuery } = await import("@/lib/catalog.server");
        return json(graphQuery(new URL(request.url).searchParams));
      },
    },
  },
});
