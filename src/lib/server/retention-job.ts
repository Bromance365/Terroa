import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Retention job (HANDOFF.md section 12): removes plan files past `delete_after`, keeps an audit
 * timestamp on the row, and purges quote requests past `retain_until` (items cascade).
 * Returns counts only; nothing personal is logged.
 */
export async function runRetention(client: SupabaseClient, now = new Date()) {
  const iso = now.toISOString();
  let plansDeleted = 0;

  const { data: plans, error } = await client
    .from("plan_uploads")
    .select("id, storage_path")
    .is("deleted_at", null)
    .lt("delete_after", iso)
    .limit(200);
  if (error) throw new Error("plan query failed");

  for (const plan of plans ?? []) {
    const { error: rmError } = await client.storage.from("plans").remove([plan.storage_path as string]);
    if (rmError) continue; // keep the row; the next run retries
    await client.from("plan_uploads").update({ deleted_at: iso, status: "deleted", extraction: null, storage_path: "" }).eq("id", plan.id);
    plansDeleted++;
  }

  const { data: purged, error: purgeError } = await client.from("quote_requests").delete().lt("retain_until", iso).select("id");
  if (purgeError) throw new Error("quote purge failed");

  return { plansDeleted, quotesPurged: purged?.length ?? 0 };
}
