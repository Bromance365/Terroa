import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { quoteRequestSchema, recomputeQuote } from "@/lib/quote-schema";
import { saveQuote } from "./quote-repository";
import { customerMessage, notifyQuote, staffMessage } from "./mailer";
import { runRetention } from "./retention-job";
import { planDeleteAfter, quoteRetainUntil } from "@/lib/retention";

const req = quoteRequestSchema.parse({
  lines: [{ productId: "p-chene-naturel", quantity: 21, unit: "box", rooms: ["Salon"], plannedAreaSqft: 374 }],
  project: { type: "residential", city: "Laval", startWindow: "month", reception: "delivery", notes: "Line1\nBcc: evil@example.com" },
  contact: { name: "Test Synthétique", email: "test@example.com", role: "contractor" },
  marketingOptIn: false,
  locale: "fr",
  website: "",
});
const recomputed = recomputeQuote(req.lines);
if (!recomputed.ok) throw new Error("fixture must recompute");

/** Minimal chainable fake of the PostgREST client calls the repository makes. */
function fakeClient(opts: { requestError?: { code: string }; itemsError?: { code: string }; existing?: string }) {
  const calls: Array<{ table: string; op: string; payload?: unknown }> = [];
  const client = {
    from(table: string) {
      return {
        insert(payload: unknown) {
          calls.push({ table, op: "insert", payload });
          const err = table === "quote_requests" ? opts.requestError : opts.itemsError;
          const result = { data: table === "quote_requests" && !err ? { id: "id-1" } : null, error: err ?? null };
          return Object.assign(Promise.resolve(result), { select: () => ({ single: async () => result }) });
        },
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.existing ? { reference: opts.existing } : null }) }) }),
        delete() {
          calls.push({ table, op: "delete" });
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  };
  return { client: client as never, calls };
}

describe("saveQuote", () => {
  it("falls back to a non-persistent reference without a database", async () => {
    const r = await saveQuote(req, recomputed, "k".repeat(20), null);
    expect(r.stored).toBe(false);
    expect(r.reference).toMatch(/^TR-\d{6}$/);
  });

  it("inserts the request then its items, with retention set", async () => {
    const { client, calls } = fakeClient({});
    const r = await saveQuote(req, recomputed, "k".repeat(20), client);
    expect(r).toMatchObject({ stored: true, duplicate: false });
    const first = calls[0]!.payload as Record<string, unknown>;
    expect(first.marketing_opt_in).toBe(false);
    expect(first.marketing_opt_in_at).toBeNull();
    expect(new Date(first.retain_until as string).getTime()).toBeGreaterThan(Date.now());
    expect(calls[1]).toMatchObject({ table: "quote_items", op: "insert" });
  });

  it("returns the first reference on an idempotent replay", async () => {
    const { client } = fakeClient({ requestError: { code: "23505" }, existing: "TR-123456" });
    expect(await saveQuote(req, recomputed, "k".repeat(20), client)).toMatchObject({ reference: "TR-123456", duplicate: true });
  });

  it("removes the request when its items fail to save", async () => {
    const { client, calls } = fakeClient({ itemsError: { code: "XX000" } });
    await expect(saveQuote(req, recomputed, "k".repeat(20), client)).rejects.toThrow();
    expect(calls.some((c) => c.op === "delete" && c.table === "quote_requests")).toBe(true);
  });
});

describe("mailer", () => {
  it("builds plain-text messages and keeps the customer address out of the subject", () => {
    const m = staffMessage("TR-000001", req, recomputed.totals);
    expect(m.subject).toBe("New quote request TR-000001");
    expect(m.text).not.toContain("<");
    expect(m.replyTo).toBe("test@example.com");
    expect(customerMessage("TR-000001", req).text).toContain("Bonjour");
  });

  it("sends nothing and never throws when mail is not configured", async () => {
    const fetchSpy = vi.fn();
    delete process.env.RESEND_API_KEY;
    delete process.env.QUOTE_NOTIFY_TO;
    expect(await notifyQuote("TR-000001", req, recomputed.totals, fetchSpy as never)).toEqual({ staff: false, customer: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("emails staff only, unless customer confirmations are explicitly enabled", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.MAIL_FROM = "Terroa <test@example.com>";
    process.env.QUOTE_NOTIFY_TO = "staff@example.com";
    delete process.env.SEND_CUSTOMER_CONFIRMATIONS;
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    const out = await notifyQuote("TR-000001", req, recomputed.totals, fetchSpy as never);
    expect(out).toEqual({ staff: true, customer: false });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    for (const k of ["RESEND_API_KEY", "MAIL_FROM", "QUOTE_NOTIFY_TO"]) delete process.env[k];
  });
});

describe("retention", () => {
  it("computes the proposed periods", () => {
    const base = new Date("2026-10-05T12:00:00Z");
    expect(quoteRetainUntil(base).toISOString()).toBe("2028-10-05T12:00:00.000Z");
    expect(planDeleteAfter(base).toISOString()).toBe("2026-11-04T12:00:00.000Z");
  });

  it("deletes expired plan files and purges expired quotes", async () => {
    const removed: string[] = [];
    const client = {
      from(table: string) {
        if (table === "plan_uploads")
          return {
            select: () => ({ is: () => ({ lt: () => ({ limit: async () => ({ data: [{ id: "a", storage_path: "x/1.pdf" }], error: null }) }) }) }),
            update: () => ({ eq: async () => ({ error: null }) }),
          };
        return { delete: () => ({ lt: () => ({ select: async () => ({ data: [{ id: 1 }, { id: 2 }], error: null }) }) }) };
      },
      storage: { from: () => ({ remove: async (paths: string[]) => (removed.push(...paths), { error: null }) }) },
    };
    expect(await runRetention(client as never)).toEqual({ plansDeleted: 1, quotesPurged: 2 });
    expect(removed).toEqual(["x/1.pdf"]);
  });
});
