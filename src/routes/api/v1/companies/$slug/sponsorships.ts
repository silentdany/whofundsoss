import { createFileRoute } from "@tanstack/react-router";
import { authorize, json } from "@/lib/http";

export const Route = createFileRoute("/api/v1/companies/$slug/sponsorships")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const denied = authorize(request);
        if (denied) return denied;
        const { sponsorshipsQuery } = await import("@/lib/catalog.server");
        const page = sponsorshipsQuery(params.slug, new URL(request.url).searchParams);
        if (!page) return json({ error: "Not found" }, 404);
        return json(page);
      },
    },
  },
});
