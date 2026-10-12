import { createFileRoute } from "@tanstack/react-router";

async function handle(request: Request) {
  const { api, serve } = await import("@/lib/public-api/data.server");
  return serve(request, (url) => api.listProjects(url.searchParams));
}

export const Route = createFileRoute("/api/projects/")({
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
