import { createHash, randomInt } from "node:crypto";
import { after } from "next/server";
import { saveQuote } from "@/lib/server/quote-repository";
import { notifyQuote } from "@/lib/server/mailer";
import { clientIp, createRateLimiter, hashKey } from "@/lib/rate-limit";
import { quoteRequestSchema, recomputeQuote, type QuoteTotals } from "@/lib/quote-schema";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 20 * 1024;
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,64}$/;

// Every POST (valid or not) counts against the loose limiter; only accepted requests
// count against the strict ones, so a typo does not lock a person out.
const looseLimiter = createRateLimiter({ limit: 30, windowMs: 10 * 60 * 1000 });
const ipLimiter = createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });
const emailLimiter = createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });

// Replays of the same key + same body return the first answer (no second reference).
const idempotent = new Map<string, { at: number; body: { reference: string; totals: QuoteTotals } }>();

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

const fail = (status: number, error: string, extra: Record<string, string> = {}) => json({ error }, status, extra);

/** Reference for honeypot answers only; real references come from the repository. */
const newReference = () => `TR-${String(randomInt(0, 1_000_000)).padStart(6, "0")}`;

/** Same-origin check: compares the Origin host with the Host the request came in on. */
function sameOrigin(request: Request): boolean {
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

function sweepIdempotent(now: number) {
  if (idempotent.size < 500) return;
  for (const [k, v] of idempotent) if (now - v.at > IDEMPOTENCY_TTL_MS) idempotent.delete(k);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail(403, "forbidden");

  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json\s*(;|$)/i.test(contentType)) return fail(415, "unsupported_media_type");

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return fail(413, "too_large");

  const ipKey = hashKey(clientIp(request.headers));
  const loose = looseLimiter.hit(ipKey);
  if (!loose.ok) return fail(429, "rate_limited", { "Retry-After": String(loose.retryAfterSec) });

  const idemKey = request.headers.get("idempotency-key") ?? "";
  if (!IDEMPOTENCY_KEY.test(idemKey)) return fail(400, "bad_request");

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return fail(400, "bad_request");
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return fail(413, "too_large");

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return fail(400, "bad_request");
  }

  const parsed = quoteRequestSchema.safeParse(data);
  if (!parsed.success) {
    // Field paths only: never echo submitted values.
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.slice(0, 2).join(".")))].slice(0, 12);
    return json({ error: "invalid", fields }, 400);
  }
  const req = parsed.data;

  // Honeypot filled: pretend it worked, store nothing, count nothing.
  if (req.website !== "") {
    return json({ reference: newReference(), totals: { products: 0, boxes: 0, panels: 0, areaSqft: 0 } });
  }

  const now = Date.now();
  sweepIdempotent(now);
  const cacheKey = `${idemKey}:${createHash("sha256").update(raw).digest("hex")}`;
  const cached = idempotent.get(cacheKey);
  if (cached && now - cached.at < IDEMPOTENCY_TTL_MS) return json(cached.body);

  const result = recomputeQuote(req.lines);
  if (!result.ok) return json({ error: "unavailable", index: result.error.index }, 422);

  const ip = ipLimiter.hit(ipKey);
  const mail = emailLimiter.hit(hashKey(req.contact.email));
  if (!ip.ok || !mail.ok) {
    return fail(429, "rate_limited", { "Retry-After": String(Math.max(ip.retryAfterSec, mail.retryAfterSec)) });
  }

  let saved;
  try {
    saved = await saveQuote(req, result, idemKey);
  } catch {
    // No details to the visitor; the failure is logged without personal data.
    console.error(JSON.stringify({ event: "quote.save_failed" }));
    return fail(500, "server_error");
  }
  const { reference } = saved;
  const body = { reference, totals: result.totals };
  idempotent.set(cacheKey, { at: now, body });

  // Structured log: no names, emails, phones, cities, notes or IPs.
  console.info(
    JSON.stringify({
      event: "quote.accepted",
      reference,
      locale: req.locale,
      lines: req.lines.length,
      boxes: result.totals.boxes,
      panels: result.totals.panels,
      marketingOptIn: req.marketingOptIn,
      stored: saved.stored,
      duplicate: saved.duplicate,
    }),
  );

  if (!saved.duplicate) after(() => notifyQuote(reference, req, result.totals));

  return json(body);
}

// Only POST is served; other methods get 405 from Next.
