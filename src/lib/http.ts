export function apiHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("Cache-Control", "no-store");
  return headers;
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: apiHeaders({ "Content-Type": "application/json" }),
  });
}

export const JSON_LIMIT = 1_000_000;
export const UPLOAD_LIMIT = 20_000_000;

export async function readJsonLimited(request: Request, limit = JSON_LIMIT): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > limit) throw new Error("payload-too-large");
  const text = await request.text();
  if (text.length > limit) throw new Error("payload-too-large");
  return text ? JSON.parse(text) : null;
}
