import { createFileRoute } from "@tanstack/react-router";

// Catch-all: any unknown /api/* path gets a JSON 404 with the usual meta,
// never the HTML app 404 page. Specific routes (/api/projects, /api/v1/...) win.
async function handle(request: Request) {
  const { api, serve } = await import("@/lib/public-api/data.server");
  return serve(request, (url) => api.notFoundRoute(url.pathname));
}

export const Route = createFileRoute("/api/$")({
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
