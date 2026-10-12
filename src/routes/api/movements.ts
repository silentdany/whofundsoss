import { createFileRoute } from "@tanstack/react-router";

async function handle(request: Request) {
  const { api, serve, loadWeek, WEEKS } = await import("@/lib/public-api/data.server");
  return serve(request, async (url) => {
    const week = url.searchParams.get("week");
    return api.movements(week, await loadWeek(week), WEEKS);
  });
}

export const Route = createFileRoute("/api/movements")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      HEAD: ({ request }) => handle(request),
      OPTIONS: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
      PUT: ({ request }) => handle(request),
      PATCH: ({ request }) => handle(request),
      DELETE: ({ request }) => handle(request),
    },
  },
});
