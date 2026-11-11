import { createFileRoute } from "@tanstack/react-router";
import { serveV1, json } from "@/lib/http";

export const Route = createFileRoute("/api/v1/leaderboard")({
  server: {
    handlers: {
      GET: ({ request }) =>
        serveV1(request, async () => {
          const { leaderboardQuery } = await import("@/lib/catalog.server");
          return json(leaderboardQuery(new URL(request.url).searchParams));
        }),
    },
  },
});
