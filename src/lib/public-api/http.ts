/**
 * HTTP layer for the public API: open CORS, read-only methods, a basic
 * per-client rate limit, and CDN caching keyed on the snapshot.
 * Pure (no Node or Vite imports) for node:test.
 */
import type { ApiResult } from "./core.ts";

export const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "access-control-allow-headers": "content-type, if-none-match",
  "access-control-expose-headers": "etag, x-ratelimit-limit, x-ratelimit-remaining, retry-after",
  "access-control-max-age": "86400",
};

/**
 * Browser + CDN cache. Data changes on deploy (Vercel purges the CDN then) and
 * when a hold reaches its review_on date (day boundary, no deploy). Short edge
 * TTL + short SWR bound that second case to about 20 minutes.
 */
export const CACHE_CONTROL = "public, max-age=60, s-maxage=600, stale-while-revalidate=600";

export type RateLimiter = {
  limit: number;
  /** Returns remaining requests, or -1 with a retry delay when over the limit. */
  take(key: string, now?: number): { allowed: boolean; remaining: number; retryAfterS: number };
};

/** Fixed-window limiter, in memory per server instance. Basic on purpose. */
export function createRateLimiter(limit = 60, windowMs = 60_000, maxKeys = 10_000): RateLimiter {
  const hits = new Map<string, { start: number; count: number }>();
  return {
    limit,
    take(key, now = Date.now()) {
      let w = hits.get(key);
      if (!w || now - w.start >= windowMs) {
        if (hits.size >= maxKeys) hits.clear();
        w = { start: now, count: 0 };
        hits.set(key, w);
      }
      w.count++;
      const allowed = w.count <= limit;
      return {
        allowed,
        remaining: Math.max(0, limit - w.count),
        retryAfterS: allowed ? 0 : Math.ceil((w.start + windowMs - now) / 1000),
      };
    },
  };
}

export function clientKey(request: Request): string {
  const h = request.headers;
  const fwd = h.get("x-vercel-forwarded-for") ?? h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "";
  return fwd.split(",")[0]!.trim() || "unknown";
}

function etagFor(snapshotTag: string, body: string): string {
  // FNV-1a over the body, prefixed by the snapshot tag: changes on each weekly snapshot.
  let h = 0x811c9dc5;
  for (let i = 0; i < body.length; i++) {
    h ^= body.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `W/"${snapshotTag}-${(h >>> 0).toString(16)}"`;
}

export async function servePublicApi(
  request: Request,
  limiter: RateLimiter,
  snapshotTag: string,
  handler: (url: URL) => ApiResult | Promise<ApiResult>,
  makeError: (status: number, message: string) => ApiResult = (status, message) => ({
    status,
    body: { error: { status, message } },
  }),
): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (method !== "GET" && method !== "HEAD") {
    return jsonResponse(makeError(405, "Read-only API: use GET."), {
      allow: "GET, HEAD, OPTIONS",
      "cache-control": "no-store",
    });
  }
  const rl = limiter.take(clientKey(request));
  const rlHeaders = { "x-ratelimit-limit": String(limiter.limit), "x-ratelimit-remaining": String(rl.remaining) };
  if (!rl.allowed) {
    return jsonResponse(
      makeError(429, "Too many requests. Slow down and retry later."),
      { ...rlHeaders, "retry-after": String(rl.retryAfterS), "cache-control": "no-store" },
    );
  }
  const result = await handler(new URL(request.url));
  const body = JSON.stringify(result.body);
  const headers: Record<string, string> = {
    ...rlHeaders,
    "cache-control": result.status === 200 ? CACHE_CONTROL : "public, max-age=60",
  };
  if (result.status === 200) {
    const etag = etagFor(snapshotTag, body);
    headers.etag = etag;
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { ...CORS_HEADERS, ...headers } });
    }
  }
  return jsonResponse(result, headers, method === "HEAD" ? null : body);
}

function jsonResponse(result: ApiResult, headers: Record<string, string>, body?: string | null): Response {
  return new Response(body === undefined ? JSON.stringify(result.body) : body, {
    status: result.status,
    headers: { ...CORS_HEADERS, "content-type": "application/json; charset=utf-8", ...headers },
  });
}
