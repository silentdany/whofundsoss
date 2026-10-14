import { CSV_BOM } from "@/lib/csv";

/**
 * NOT a secret. Public demo key, printed on /method ("For developers: API") so
 * anyone can try the read-only /api/v1 routes. It only gates public aggregate
 * data (no private amounts, held or spam entries; see the project rules) and
 * exists to make clients identify the documented API, not to protect anything.
 * Do not reuse this pattern for a real credential: put that in an env var.
 */
export const API_KEY = "wfo_preview_floor";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function csv(body: string, filename: string): Response {
  return new Response(body.startsWith(CSV_BOM) ? body : CSV_BOM + body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

export function authorize(request: Request): Response | null {
  if (request.headers.get("x-api-key") === API_KEY) return null;
  return json({ error: "Send header X-API-Key." }, 401);
}
