import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { CompanySearch } from "@/components/company-search";
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
        <h1 className="font-serif text-4xl sm:text-5xl">This page does not exist.</h1>
        <p className="mt-3 max-w-lg text-secondary">
          The link may be old or mistyped. Look up a company instead, or head to one of these pages.
        </p>
        <CompanySearch className="mt-6 max-w-xl" />
        <ul className="mt-8 flex flex-wrap gap-3">
          {[
            ["/ranking", "Ranking"],
            ["/movements", "What changed"],
            ["/method", "How we count"],
          ].map(([to, label]) => (
            <li key={to}>
              <Link to={to} className="inline-flex min-h-11 items-center rounded-full bg-sand px-5 text-sm font-medium hover:bg-line">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}
