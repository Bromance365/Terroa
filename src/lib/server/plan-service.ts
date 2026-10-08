import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sniff } from "@/lib/plan-reader/validate-file";
import { planDeleteAfter } from "@/lib/retention";
import { countPdfPages, hasActiveContent } from "./pdf-guard";
import { analyzeWithModel, configuredModel, createModelClient, type ModelClient } from "./plan-model";
import { getServiceClient } from "./supabase";
import type { Extraction } from "@/lib/plan-reader/types";

export const MAX_BYTES = 20 * 1024 * 1024;
export const MAX_PAGES = 10;
const BUCKET = "plans";
const EXT = { pdf: "pdf", jpeg: "jpg", png: "png" } as const;
const MIME = { pdf: "application/pdf", jpeg: "image/jpeg", png: "image/png" } as const;

/**
 * The real plan reader stays OFF until Vy flips PLAN_READER_ENABLED=true (after the privacy impact
 * assessment) AND the key, the model and the database are all configured.
 */
export function planReaderEnabled() {
  return process.env.PLAN_READER_ENABLED === "true" && Boolean(process.env.ANTHROPIC_API_KEY) && Boolean(configuredModel()) && Boolean(getServiceClient());
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

export function tokenMatches(token: string, storedHash: string) {
  const a = Buffer.from(sha256(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type CreateResult =
  | { ok: true; id: string; token: string; uploadUrl: string }
  | { ok: false; error: "bad_type" | "too_large" | "server_error" };

export async function createUpload(input: { mime: string; bytes: number }, client: SupabaseClient | null = getServiceClient()): Promise<CreateResult> {
  const kind = (Object.keys(MIME) as Array<keyof typeof MIME>).find((k) => MIME[k] === input.mime);
  if (!kind) return { ok: false, error: "bad_type" };
  if (!Number.isInteger(input.bytes) || input.bytes < 8 || input.bytes > MAX_BYTES) return { ok: false, error: "too_large" };
  if (!client) return { ok: false, error: "server_error" };

  const token = newToken();
  const path = `${crypto.randomUUID()}.${EXT[kind]}`; // random key: no user input in storage paths
  const { data: row, error } = await client
    .from("plan_uploads")
    .insert({ upload_token_hash: sha256(token), storage_path: path, mime: input.mime, bytes: input.bytes, delete_after: planDeleteAfter().toISOString() })
    .select("id")
    .single();
  if (error || !row) return { ok: false, error: "server_error" };

  const { data: signed, error: signError } = await client.storage.from(BUCKET).createSignedUploadUrl(path);
  if (signError || !signed) {
    await client.from("plan_uploads").delete().eq("id", row.id);
    return { ok: false, error: "server_error" };
  }
  return { ok: true, id: row.id as string, token, uploadUrl: signed.signedUrl };
}

interface PlanRow {
  id: string;
  upload_token_hash: string;
  storage_path: string;
  status: string;
}

async function loadRow(client: SupabaseClient, id: string, token: string): Promise<PlanRow | null> {
  const { data } = await client.from("plan_uploads").select("id, upload_token_hash, storage_path, status").eq("id", id).maybeSingle();
  if (!data || !tokenMatches(token, data.upload_token_hash as string)) return null;
  return data as PlanRow;
}

export type AnalyzeResult =
  | { ok: true; extraction: Extraction; pages: number; readAt: string }
  | { ok: false; error: "not_found" | "already_analyzed" | "bad_file" | "too_many_pages" | "active_content" | "server_error" };

/** Strips EXIF/GPS and normalises orientation. Output is JPEG (or PNG for PNG input) re-encoded by sharp. */
export async function cleanImage(bytes: Uint8Array, kind: "jpeg" | "png"): Promise<Uint8Array> {
  const pipeline = sharp(Buffer.from(bytes), { limitInputPixels: 100_000_000 }).rotate().resize({ width: 3200, height: 3200, fit: "inside", withoutEnlargement: true });
  // sharp drops all metadata (including GPS) unless withMetadata() is called.
  const out = kind === "png" ? await pipeline.png().toBuffer() : await pipeline.jpeg({ quality: 90 }).toBuffer();
  return new Uint8Array(out);
}

export async function analyzeUpload(
  id: string,
  token: string,
  deps: { client?: SupabaseClient | null; model?: ModelClient | null; modelName?: string | null } = {},
): Promise<AnalyzeResult> {
  const client = deps.client === undefined ? getServiceClient() : deps.client;
  const model = deps.model === undefined ? createModelClient() : deps.model;
  const modelName = deps.modelName === undefined ? configuredModel() : deps.modelName;
  if (!client || !model || !modelName) return { ok: false, error: "server_error" };

  const row = await loadRow(client, id, token);
  if (!row) return { ok: false, error: "not_found" };
  // One analysis per upload: a token cannot be used to run the model repeatedly (cost abuse).
  if (row.status !== "uploaded") return { ok: false, error: "already_analyzed" };
  const { error: lockError, data: locked } = await client.from("plan_uploads").update({ status: "analysing" }).eq("id", id).eq("status", "uploaded").select("id");
  if (lockError || !locked?.length) return { ok: false, error: "already_analyzed" };

  const fail = async (error: Extract<AnalyzeResult, { ok: false }>["error"]): Promise<AnalyzeResult> => {
    await client.from("plan_uploads").update({ status: "failed" }).eq("id", id);
    return { ok: false, error };
  };

  const { data: blob, error: dlError } = await client.storage.from(BUCKET).download(row.storage_path);
  if (dlError || !blob) return fail("bad_file");
  let bytes: Uint8Array = new Uint8Array(await blob.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) return fail("bad_file");

  const kind = sniff(bytes.subarray(0, 16));
  if (!kind || kind === "heic") return fail("bad_file");

  let pages = 1;
  if (kind === "pdf") {
    if (hasActiveContent(bytes)) return fail("active_content");
    pages = countPdfPages(bytes);
    if (pages < 1) return fail("bad_file");
    if (pages > MAX_PAGES) return fail("too_many_pages");
  } else {
    try {
      bytes = await cleanImage(bytes, kind);
    } catch {
      return fail("bad_file");
    }
    // Replace the stored copy with the cleaned one so no GPS data stays in storage.
    await client.storage.from(BUCKET).upload(row.storage_path, Buffer.from(bytes), { upsert: true, contentType: MIME[kind] });
  }

  let extraction: Extraction | null;
  try {
    extraction = await analyzeWithModel(model, modelName, { bytes, kind });
  } catch {
    return fail("server_error");
  }
  if (!extraction) extraction = { readable: false, units: "unknown", scaleText: null, rooms: [], warnings: [] };

  await client.from("plan_uploads").update({ status: "done", extraction, model: modelName, pages }).eq("id", id);
  return { ok: true, extraction, pages, readAt: new Date().toISOString() };
}

/** Deletes the file at once and the extraction; keeps the row as an audit record. */
export async function deleteUpload(id: string, token: string, client: SupabaseClient | null = getServiceClient()): Promise<"deleted" | "not_found" | "server_error"> {
  if (!client) return "server_error";
  const row = await loadRow(client, id, token);
  if (!row) return "not_found";
  if (row.storage_path) {
    const { error } = await client.storage.from(BUCKET).remove([row.storage_path]);
    if (error) return "server_error";
  }
  const { error } = await client.from("plan_uploads").update({ status: "deleted", deleted_at: new Date().toISOString(), extraction: null, storage_path: "" }).eq("id", id);
  return error ? "server_error" : "deleted";
}
