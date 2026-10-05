import "server-only";
import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProduct } from "@/lib/catalog";
import { quoteRetainUntil } from "@/lib/retention";
import type { QuoteRequest, QuoteTotals, RecomputeResult } from "@/lib/quote-schema";
import { getServiceClient } from "./supabase";

export const NOTICE_VERSION = "2026-10-draft";

const newReference = () => `TR-${String(randomInt(0, 1_000_000)).padStart(6, "0")}`;

export interface SavedQuote {
  reference: string;
  totals: QuoteTotals;
  /** false when no database is configured (phase 1 mode): nothing was stored. */
  stored: boolean;
  /** true when the idempotency key had already been saved. */
  duplicate: boolean;
}

type Recomputed = Extract<RecomputeResult, { ok: true }>;

/**
 * Stores a validated, recomputed quote request and its items.
 * Falls back to a non-persistent reference when Supabase is not configured.
 */
export async function saveQuote(
  req: QuoteRequest,
  result: Recomputed,
  idempotencyKey: string,
  client: SupabaseClient | null = getServiceClient(),
): Promise<SavedQuote> {
  if (!client) return { reference: newReference(), totals: result.totals, stored: false, duplicate: false };

  const now = new Date();
  for (let attempt = 0; attempt < 5; attempt++) {
    const reference = newReference();
    const { data, error } = await client
      .from("quote_requests")
      .insert({
        reference,
        locale: req.locale,
        project_name: req.project.name ?? null,
        project_type: req.project.type,
        site_city: req.project.city,
        start_window: req.project.startWindow,
        reception: req.project.reception,
        notes: req.project.notes ?? null,
        contact_name: req.contact.name,
        contact_email: req.contact.email,
        contact_company: req.contact.company ?? null,
        contact_phone: req.contact.phone ?? null,
        contact_role: req.contact.role,
        marketing_opt_in: req.marketingOptIn,
        marketing_opt_in_at: req.marketingOptIn ? now.toISOString() : null,
        notice_version: NOTICE_VERSION,
        idempotency_key: idempotencyKey,
        retain_until: quoteRetainUntil(now).toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        // Unique violation: either the idempotency key (a replay) or the reference (rare collision).
        const { data: existing } = await client.from("quote_requests").select("reference").eq("idempotency_key", idempotencyKey).maybeSingle();
        if (existing) return { reference: existing.reference as string, totals: result.totals, stored: true, duplicate: true };
        continue; // reference collision: draw another
      }
      throw new Error(`quote insert failed: ${error.code ?? "unknown"}`);
    }

    const requestId = data.id as string;
    const items = result.lines.map((line, i) => {
      const input = req.lines[i];
      const product = getProduct(line.productId);
      return {
        quote_request_id: requestId,
        product_id: line.productId,
        product_snapshot: product ? { id: product.id, name_fr: product.name_fr, name_en: product.name_en, kind: product.kind } : { id: line.productId },
        quantity: line.quantity,
        unit: line.unit,
        rooms: input?.rooms ?? [],
        planned_area_sqft: input?.plannedAreaSqft ?? null,
      };
    });
    const { error: itemsError } = await client.from("quote_items").insert(items);
    if (itemsError) {
      // Compensate so a half-saved request never reaches staff.
      await client.from("quote_requests").delete().eq("id", requestId);
      throw new Error(`quote items insert failed: ${itemsError.code ?? "unknown"}`);
    }
    return { reference, totals: result.totals, stored: true, duplicate: false };
  }
  throw new Error("could not allocate a unique quote reference");
}
