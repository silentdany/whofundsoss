import { createFileRoute } from "@tanstack/react-router";
import { authorize, json } from "@/lib/http";

export const Route = createFileRoute("/api/v1/deltas")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = authorize(request);
        if (denied) return denied;
        const { deltasPayload } = await import("@/lib/catalog.server");
        return json(deltasPayload(new URL(request.url).searchParams));
      },
    },
  },
});
