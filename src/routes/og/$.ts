import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/og/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { pagePathFromOgSplat, renderOgCard } = await import("@/lib/og/card");
        const pagePath = pagePathFromOgSplat(params._splat ?? "");
        if (!pagePath) return new Response("Not found", { status: 404 });
        try {
          const card = await renderOgCard(pagePath, new URL(request.url).origin);
          if (!card) return new Response("Not found", { status: 404 });
          return new Response(new Uint8Array(card.body), {
            headers: {
              "content-type": card.contentType,
              "cache-control": "public, max-age=86400",
            },
          });
        } catch (error) {
          console.error("[og]", pagePath, error);
          return new Response("OG card failed", { status: 500 });
        }
      },
    },
  },
});
