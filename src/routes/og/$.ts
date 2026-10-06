import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/og/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { pagePathFromOgSplat, renderOgCard } = await import("@/lib/og/card");
        const pagePath = pagePathFromOgSplat(params._splat ?? "");
        if (!pagePath) return new Response("Not found", { status: 404 });
        const card = await renderOgCard(pagePath);
        if (!card) return new Response("Not found", { status: 404 });
        return new Response(new Uint8Array(card.body), {
          headers: {
            "content-type": card.contentType,
            "cache-control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
