import { createFileRoute } from "@tanstack/react-router";
import { companyIndexable } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

/** Indexable static pages. Old FR slugs are redirects and never listed. */
const STATIC_PATHS = ["/", "/ranking", "/movements", "/method", "/mysteries", "/graph", "/watchlist"];

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { getMeta, indexableCompanySlugs } = await import("@/lib/catalog.server");
        const lastmod = getMeta().collectedAt;
        const paths = [
          ...STATIC_PATHS,
          ...indexableCompanySlugs(companyIndexable).map((slug) => `/company/${encodeURIComponent(slug)}`),
        ];
        const urls = paths
          .map((path) => `  <url><loc>${escapeXml(absoluteUrl(path))}</loc><lastmod>${lastmod}</lastmod></url>`)
          .join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
        return new Response(xml, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=0, s-maxage=3600",
          },
        });
      },
    },
  },
});
