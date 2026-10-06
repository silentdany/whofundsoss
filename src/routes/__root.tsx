import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { Shell } from "@/components/shell";
import { notFoundHead, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: ({ matches }) => {
    // Only the root matched: global 404. Leaf routes own title/description/canonical.
    const isGlobalNotFound = matches.length <= 1 || matches.some((match) => match.status === "notFound");
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: SITE_NAME },
        { name: "theme-color", content: "#faf9f7" },
        { name: "apple-mobile-web-app-title", content: SITE_NAME },
        { name: "application-name", content: SITE_NAME },
        ...(isGlobalNotFound ? notFoundHead().meta : []),
        { "script:ld+json": organizationJsonLd() },
        { "script:ld+json": websiteJsonLd() },
      ],
      links: [
        { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        { rel: "manifest", href: "/manifest.webmanifest" },
        { rel: "stylesheet", href: appCss },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Manrope:wght@400;500;600;700&display=swap",
        },
      ],
    };
  },
  notFoundComponent: NotFound,
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});

function NotFound() {
  return (
    <Shell>
      <div className="mx-auto max-w-[1120px] px-5 py-24">
        <h1 className="font-serif text-4xl">Page not found.</h1>
        <Link to="/ranking" className="mt-6 inline-block text-sage">
          See the ranking
        </Link>
      </div>
    </Shell>
  );
}
