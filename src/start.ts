import {
  sentryGlobalFunctionMiddleware,
  sentryGlobalRequestMiddleware,
} from "@sentry/tanstackstart-react";
import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { redirectTarget } from "@/lib/redirects";
import { SITE_URL } from "@/lib/site";

// Same CSRF guard TanStack Start applies by default when no start instance exists.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

/** 308s for old slugs / legacy host, and `X-Robots-Tag: noindex` off production. */
const seoMiddleware = createMiddleware({ type: "request" }).server(async ({ request, next }) => {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  if (request.method === "GET" || request.method === "HEAD") {
    const target = redirectTarget(url, host, SITE_URL);
    if (target) {
      return new Response(null, { status: 308, headers: { location: target } });
    }
  }
  const result = await next();
  if (process.env.VERCEL_ENV !== "production" && result.response instanceof Response) {
    try {
      result.response.headers.set("x-robots-tag", "noindex");
    } catch {
      // Immutable headers (e.g. a fetched Response): leave as is.
    }
  }
  return result;
});

export const startInstance = createStart(() => ({
  // Sentry stays first so it observes failures from the middleware after it.
  requestMiddleware: [sentryGlobalRequestMiddleware, csrfMiddleware, seoMiddleware],
  functionMiddleware: [sentryGlobalFunctionMiddleware],
}));
