import { createFileRoute } from "@tanstack/react-router";
import { serveV1, csv } from "@/lib/http";

export const Route = createFileRoute("/api/v1/export/snapshots")({
  server: {
    handlers: {
      GET: ({ request }) =>
        serveV1(request, async () => {
          const { snapshotsCsv } = await import("@/lib/catalog.server");
          return csv(await snapshotsCsv(), "snapshots.csv");
        }),
    },
  },
});
