import { createFileRoute } from "@tanstack/react-router";
import { serveV1, json } from "@/lib/http";

export const Route = createFileRoute("/api/v1/companies/$slug/sponsorships")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        serveV1(request, async () => {
          const { sponsorshipsQuery } = await import("@/lib/catalog.server");
          const page = sponsorshipsQuery(params.slug, new URL(request.url).searchParams);
          if (!page) return json({ error: "Not found" }, 404);
          return json(page);
        }),
    },
  },
});
