import { createFileRoute } from "@tanstack/react-router";
import { serveV1, json } from "@/lib/http";

export const Route = createFileRoute("/api/v1/deltas")({
  server: {
    handlers: {
      GET: ({ request }) =>
        serveV1(request, async () => {
          const { deltasPayload } = await import("@/lib/catalog.server");
          return json(await deltasPayload(new URL(request.url).searchParams));
        }),
    },
  },
});
