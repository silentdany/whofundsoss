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
  return new Response(body, {
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
