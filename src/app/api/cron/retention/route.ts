import { timingSafeEqual } from "node:crypto";
import { getServiceClient } from "@/lib/server/supabase";
import { runRetention } from "@/lib/server/retention-job";

export const runtime = "nodejs";

const headers = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" };
const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers });

function authorized(request: Request, secret: string) {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Called by Vercel Cron (it sends `Authorization: Bearer $CRON_SECRET`). Fails closed without a secret. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return reply({ error: "not_configured" }, 503);
  if (!authorized(request, secret)) return reply({ error: "unauthorized" }, 401);
  const client = getServiceClient();
  if (!client) return reply({ error: "not_configured" }, 503);
  try {
    return reply(await runRetention(client), 200);
  } catch {
    console.error(JSON.stringify({ event: "retention.failed" }));
    return reply({ error: "server_error" }, 500);
  }
}
