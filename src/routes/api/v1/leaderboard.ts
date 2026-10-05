import { createFileRoute } from "@tanstack/react-router";
import { authorize, json } from "@/lib/http";

export const Route = createFileRoute("/api/v1/leaderboard")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = authorize(request);
        if (denied) return denied;
        const { leaderboardQuery } = await import("@/lib/catalog.server");
        return json(leaderboardQuery(new URL(request.url).searchParams));
      },
    },
  },
});
