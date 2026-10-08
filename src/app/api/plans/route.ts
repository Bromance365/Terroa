import { z } from "zod";
import { clientIp, createRateLimiter, hashKey } from "@/lib/rate-limit";
import { fail, json, sameOrigin } from "@/lib/server/http";
import { createUpload, planReaderEnabled } from "@/lib/server/plan-service";

export const runtime = "nodejs";

const body = z.strictObject({ mime: z.enum(["application/pdf", "image/jpeg", "image/png"]), bytes: z.number().int().min(8).max(20 * 1024 * 1024) });

// Creating an upload row is cheap but still limited per IP; the analysis has its own stricter limits.
const hourly = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });
const daily = createRateLimiter({ limit: 30, windowMs: 24 * 60 * 60 * 1000 });

/** POST /api/plans: declare type and size, receive a signed upload URL and a one-time upload token. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail(403, "forbidden");
  if (!planReaderEnabled()) return fail(503, "not_configured");
  if (!/^application\/json\s*(;|$)/i.test(request.headers.get("content-type") ?? "")) return fail(415, "unsupported_media_type");

  const key = hashKey(clientIp(request.headers));
  const h = hourly.hit(key);
  const d = daily.hit(key);
  if (!h.ok || !d.ok) return fail(429, "rate_limited", { "Retry-After": String(Math.max(h.retryAfterSec, d.retryAfterSec)) });

  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > 1024) return fail(413, "too_large");
    raw = JSON.parse(text);
  } catch {
    return fail(400, "bad_request");
  }
  const parsed = body.safeParse(raw);
  if (!parsed.success) return fail(400, "invalid");

  const result = await createUpload(parsed.data);
  if (!result.ok) return fail(result.error === "server_error" ? 500 : 400, result.error);
  // The token is returned once and never stored in clear text on the server.
  return json({ id: result.id, token: result.token, uploadUrl: result.uploadUrl });
}
