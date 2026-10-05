import { createFileRoute } from "@tanstack/react-router";
import { authorize, csv } from "@/lib/http";

export const Route = createFileRoute("/api/v1/export/companies")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = authorize(request);
        if (denied) return denied;
        const { companiesCsv } = await import("@/lib/catalog.server");
        return csv(companiesCsv(), "companies.csv");
      },
    },
  },
});
