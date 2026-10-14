import { CSV_BOM } from "@/lib/csv";

/**
 * Shared response helpers for the keyed /api/v1 routes.
 *
 * The key below is NOT a secret: it is the public demo key printed on /method
 * ("For developers: API"). It only makes clients identify the documented API;
 * it protects nothing. What keeps spam, held and excluded (pending) entries and
 * private amounts out of /api/v1 is the server-side filtering in
 * catalog.server.ts (`isV1Hidden`), not this key. Do not reuse this pattern for
 * a real credential: put that in an env var.
 *
 * Rate limit: fixed window per IP AND per key, kept in memory per serverless
 * instance (there is no shared KV/Redis store on this project). It is a
 * best-effort floor: a client spread over several warm instances gets up to
 * N × the limit. Cached GETs are served by the Vercel CDN and never count.
 * For a hard global limit, move the counters to a shared store (Upstash/KV) or
 * a Vercel WAF rate-limit rule.
 */
export const API_KEY = "wfo_preview_floor";

/** Public GET responses: CDN cache 5 min, then serve stale up to 1 h while revalidating. */
export const V1_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=3600";
const NO_STORE = "no-store";

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": NO_STORE,
      ...extra,
    },
  });
}

export function csv(body: string, filename: string): Response {
  return new Response(body.startsWith(CSV_BOM) ? body : CSV_BOM + body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": NO_STORE,
    },
  });
}

export function authorize(request: Request): Response | null {
  if (request.headers.get("x-api-key") === API_KEY) return null;
  return json({ error: "Send header X-API-Key." }, 401);
}

type Window = { start: number; count: number };

/** Fixed-window counter, in memory (see the header comment for its limits). */
export function createWindowLimiter(limit: number, windowMs: number, maxKeys = 10_000) {
  const hits = new Map<string, Window>();
  return {
    limit,
    take(key: string, now = Date.now()) {
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
        retryAfterS: allowed ? 0 : Math.max(1, Math.ceil((w.start + windowMs - now) / 1000)),
      };
    },
  };
}

export type WindowLimiter = ReturnType<typeof createWindowLimiter>;

export function clientIp(request: Request): string {
  const h = request.headers;
  const fwd = h.get("x-vercel-forwarded-for") ?? h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "";
  return fwd.split(",")[0]!.trim() || "unknown";
}

export const V1_LIMITS = { perIp: 60, perKey: 600, windowMs: 60_000 };
const ipLimiter = createWindowLimiter(V1_LIMITS.perIp, V1_LIMITS.windowMs);
const keyLimiter = createWindowLimiter(V1_LIMITS.perKey, V1_LIMITS.windowMs);

/**
 * Wrapper for every /api/v1 GET: per-IP limit (also counts bad-key requests),
 * key check, per-key limit, then the handler. 200 answers get the CDN cache
 * header (Vary on the key so an unauthenticated request never hits a cached
 * 200); errors are no-store.
 */
export async function serveV1(
  request: Request,
  handler: () => Response | Promise<Response>,
  limiters: { ip: WindowLimiter; key: WindowLimiter } = { ip: ipLimiter, key: keyLimiter },
): Promise<Response> {
  const now = Date.now();
  const ip = limiters.ip.take(`ip:${clientIp(request)}`, now);
  if (!ip.allowed) return tooMany(ip.retryAfterS, limiters.ip.limit);
  const denied = authorize(request);
  if (denied) return denied;
  const key = limiters.key.take(`key:${request.headers.get("x-api-key")}`, now);
  if (!key.allowed) return tooMany(key.retryAfterS, limiters.key.limit);
  const res = await handler();
  const headers = new Headers(res.headers);
  headers.set("x-ratelimit-limit", String(limiters.ip.limit));
  headers.set("x-ratelimit-remaining", String(Math.min(ip.remaining, key.remaining)));
  headers.set("vary", "X-API-Key");
  headers.set("cache-control", res.status === 200 ? V1_CACHE_CONTROL : NO_STORE);
  return new Response(res.body, { status: res.status, headers });
}

function tooMany(retryAfterS: number, limit: number): Response {
  return json({ error: "Too many requests. Slow down and retry later." }, 429, {
    "retry-after": String(retryAfterS),
    "x-ratelimit-limit": String(limit),
    "x-ratelimit-remaining": "0",
  });
}
