import { clientIp, createRateLimiter, hashKey } from "@/lib/rate-limit";
import { bearer, fail, json, sameOrigin, UUID } from "@/lib/server/http";
import { analyzeUpload, planReaderEnabled } from "@/lib/server/plan-service";

export const runtime = "nodejs";
export const maxDuration = 120;

// Cost control (SECURITY_PRIVACY abuse case 6): 5 analyses per hour and 20 per day per IP.
const hourly = createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });
const daily = createRateLimiter({ limit: 20, windowMs: 24 * 60 * 60 * 1000 });

const STATUS = { not_found: 404, already_analyzed: 409, bad_file: 422, too_many_pages: 422, active_content: 422, server_error: 500 } as const;

/** POST /api/plans/{id}/analyze: needs the upload token (Authorization: Bearer). One analysis per upload. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return fail(403, "forbidden");
  if (!planReaderEnabled()) return fail(503, "not_configured");
  const { id } = await ctx.params;
  const token = bearer(request);
  if (!UUID.test(id) || !token) return fail(401, "unauthorized");

  const key = hashKey(clientIp(request.headers));
  const h = hourly.hit(key);
  const d = daily.hit(key);
  if (!h.ok || !d.ok) return fail(429, "rate_limited", { "Retry-After": String(Math.max(h.retryAfterSec, d.retryAfterSec)) });

  const result = await analyzeUpload(id, token);
  if (!result.ok) {
    // Generic errors only: nothing about the file or the model reaches the visitor.
    console.error(JSON.stringify({ event: "plan.analyze_failed", reason: result.error }));
    return fail(STATUS[result.error], result.error);
  }
  console.info(JSON.stringify({ event: "plan.analyzed", rooms: result.extraction.rooms.length, readable: result.extraction.readable, pages: result.pages }));
  return json({ extraction: result.extraction, pages: result.pages, readAt: result.readAt });
}
