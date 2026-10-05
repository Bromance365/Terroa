import { createHash } from "node:crypto";

/**
 * Minimal fixed-window rate limiter kept in memory.
 *
 * PHASE 1 LIMITATION: state lives in one server instance, so serverless cold starts and
 * multiple instances each keep their own counters. Replace the store with a shared one
 * (Upstash, Supabase, Vercel KV) before launch; the call sites stay the same.
 */
export interface RateLimiter {
  /** Counts one hit for `key`. `ok` is false once the window's limit is exceeded. */
  hit(key: string): { ok: boolean; retryAfterSec: number };
  /** Reads the state without counting. */
  peek(key: string): { ok: boolean; retryAfterSec: number };
}

const MAX_KEYS = 10_000;

export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  const sweep = (now: number) => {
    if (buckets.size < MAX_KEYS) return;
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    // Still full of live keys: drop the oldest entries rather than grow without bound.
    if (buckets.size >= MAX_KEYS) {
      const drop = buckets.size - MAX_KEYS + 1000;
      let i = 0;
      for (const k of buckets.keys()) {
        if (i++ >= drop) break;
        buckets.delete(k);
      }
    }
  };

  const state = (key: string, now: number) => {
    const b = buckets.get(key);
    return b && b.resetAt > now ? b : undefined;
  };

  return {
    hit(key) {
      const now = Date.now();
      sweep(now);
      let b = state(key, now);
      if (!b) {
        b = { count: 0, resetAt: now + windowMs };
        buckets.set(key, b);
      }
      b.count += 1;
      return { ok: b.count <= limit, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
    },
    peek(key) {
      const now = Date.now();
      const b = state(key, now);
      if (!b) return { ok: true, retryAfterSec: 0 };
      return { ok: b.count < limit, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
    },
  };
}

/** Salted SHA-256 so raw IPs and emails never sit in memory, logs or keys. */
export function hashKey(value: string): string {
  const salt = process.env.RATE_LIMIT_SALT ?? "terroa-dev-salt";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

/** Best-effort client IP from proxy headers (first hop of x-forwarded-for). */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip")?.trim() || "unknown";
}
