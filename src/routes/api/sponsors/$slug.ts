import { createFileRoute } from "@tanstack/react-router";

async function handle(request: Request, params: { slug: string }) {
  const { api, serve } = await import("@/lib/public-api/data.server");
  return serve(request, () => api.getSponsor(params.slug));
}

export const Route = createFileRoute("/api/sponsors/$slug")({
  server: {
    handlers: {
      GET: ({ request, params }) => handle(request, params),
      HEAD: ({ request, params }) => handle(request, params),
      OPTIONS: ({ request, params }) => handle(request, params),
      POST: ({ request, params }) => handle(request, params),
      PUT: ({ request, params }) => handle(request, params),
      PATCH: ({ request, params }) => handle(request, params),
      DELETE: ({ request, params }) => handle(request, params),
    },
  },
});
