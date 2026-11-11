import { createFileRoute } from "@tanstack/react-router";
import { serveV1, json } from "@/lib/http";

export const Route = createFileRoute("/api/v1/companies/$slug/")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        serveV1(request, async () => {
          const { companyApi } = await import("@/lib/catalog.server");
          const company = companyApi(params.slug);
          if (!company) return json({ error: "Not found" }, 404);
          return json(company);
        }),
    },
  },
});
