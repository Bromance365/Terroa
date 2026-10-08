import "server-only";

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

export const fail = (status: number, error: string, extra: Record<string, string> = {}) => json({ error }, status, extra);

/** Same-origin check: compares the Origin host with the Host the request came in on. */
export function sameOrigin(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const hosts = [request.headers.get("host"), request.headers.get("x-forwarded-host")].filter(Boolean);
  return hosts.includes(originHost);
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function bearer(request: Request): string {
  const h = request.headers.get("authorization") ?? "";
  return /^Bearer [A-Za-z0-9_-]{32,64}$/.test(h) ? h.slice(7) : "";
}
