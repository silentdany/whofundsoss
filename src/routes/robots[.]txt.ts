import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl } from "@/lib/site";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const { isProductionDeployment } = await import("@/lib/seo-env.server");
        const body = isProductionDeployment()
          ? ["User-agent: *", "Allow: /", "Disallow: /api/", `Sitemap: ${absoluteUrl("/sitemap.xml")}`, ""]
          : ["User-agent: *", "Disallow: /", ""];
        return new Response(body.join("\n"), {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=0, s-maxage=3600",
          },
        });
      },
    },
  },
});
