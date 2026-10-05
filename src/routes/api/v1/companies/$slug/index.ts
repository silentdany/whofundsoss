import { createFileRoute } from "@tanstack/react-router";
import { authorize, json } from "@/lib/http";

export const Route = createFileRoute("/api/v1/companies/$slug/")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const denied = authorize(request);
        if (denied) return denied;
        const { companyApi } = await import("@/lib/catalog.server");
        const company = companyApi(params.slug);
        if (!company) return json({ error: "Not found" }, 404);
        return json(company);
      },
    },
  },
});
