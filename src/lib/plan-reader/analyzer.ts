import planSample from "@data/plan-sample.json";
import type { Locale } from "@/i18n/routing";
import { parseUntrustedExtraction, type Extraction } from "./types";
import type { PlanFileKind } from "./validate-file";

export interface AnalyzeOptions {
  signal?: AbortSignal;
  /** Mock only: "unreadable" forces the unreadable state (URL `?demo=unreadable`). */
  demo?: "unreadable" | null;
  locale?: Locale;
  /** Kind already verified by magic bytes in validatePlanFile. */
  kind?: PlanFileKind;
}

export interface AnalysisResult {
  /** Validated and cleaned model output. Never contains areas: those are recomputed in compute.ts. */
  extraction: Extraction;
  pages: number;
  /** ISO timestamp of the reading. */
  readAt: string;
  /** true for the built-in sample (nothing was read from the file). */
  demo: boolean;
  /** Server-side upload credentials, kept in memory only, used to delete the plan on request. */
  remote?: { id: string; token: string };
  /** Optional per-room suggestions, index-aligned with extraction.rooms (mock only; the real analyzer sends none). */
  hints?: { productId: (string | null)[]; included: boolean[] };
}

export type PlanAnalyzer = (file: File, options?: AnalyzeOptions) => Promise<AnalysisResult>;

export class AnalysisAborted extends Error {
  constructor() {
    super("aborted");
    this.name = "AnalysisAborted";
  }
}

const MOCK_DELAY_MS = 1500;

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new AnalysisAborted());
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AnalysisAborted());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** English versions of the sample's French reasons (the real model answers in French; see the schema). */
const REASON_EN: Record<string, string> = {
  "Cote partiellement lisible sur le plan. Confirmez la largeur.": "Dimension partly legible on the plan. Confirm the width.",
  "Placard inclus dans la surface. Retirez-le au besoin.": "Closet included in the area. Remove it if needed.",
};

/**
 * Phase 1 MOCK. Nothing leaves the browser: no network, no upload, no Anthropic call, and the file
 * is not even read. After ~1.5 s it returns data/plan-sample.json, run through the same untrusted-output
 * validation the real response will go through.
 */
export const mockAnalyzer: PlanAnalyzer = async (file, options = {}) => {
  void file; // intentionally unused: the mock never reads the file
  await wait(MOCK_DELAY_MS, options.signal);

  const readAt = new Date().toISOString();
  if (options.demo === "unreadable") {
    return {
      extraction: { readable: false, units: "unknown", scaleText: null, rooms: [], warnings: [] },
      pages: 1,
      readAt,
      demo: true,
    };
  }

  const raw = {
    readable: true,
    units: "imperial",
    scaleText: planSample.scale,
    rooms: planSample.rooms.map((r) => ({
      label: r.label,
      page: 1,
      lengthFt: r.lengthFt,
      widthFt: r.widthFt,
      confidence: r.confidence,
      ...(r.reason ? { reason: options.locale === "en" ? (REASON_EN[r.reason] ?? r.reason) : r.reason } : {}),
      bbox: r.bbox,
    })),
    warnings: [],
  };
  const extraction = parseUntrustedExtraction(raw);
  if (!extraction) throw new Error("invalid extraction");
  return {
    extraction,
    pages: planSample.pages,
    readAt,
    demo: true,
    hints: { productId: planSample.rooms.map((r) => r.product), included: planSample.rooms.map((r) => r.included) },
  };
};

/** Raised by the API analyzer; `code` is the server's generic error or a client-side reason. */
export class AnalysisError extends Error {
  constructor(public code: "rate_limited" | "failed" | "network") {
    super(code);
    this.name = "AnalysisError";
  }
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const v: unknown = await res.json();
    return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Best effort: the retention job removes anything this misses. Never throws. */
export async function deleteRemotePlan(remote: { id: string; token: string }) {
  try {
    await fetch(`/api/plans/${encodeURIComponent(remote.id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${remote.token}` } });
  } catch {
    // ignore
  }
}

/**
 * Real analyzer (phase 3): signed upload to the private `plans` bucket, then server-side analysis.
 * When the server says the plan reader is not enabled (503), falls back to the labelled demo so the
 * page keeps working before the privacy assessment is signed off.
 */
export const apiAnalyzer: PlanAnalyzer = async (file, options = {}) => {
  const { signal } = options;
  const mime = file.type || (options.kind === "pdf" ? "application/pdf" : options.kind === "png" ? "image/png" : "image/jpeg");
  let remote: { id: string; token: string } | undefined;
  try {
    const created = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mime, bytes: file.size }),
      signal,
    });
    if (created.status === 503) return mockAnalyzer(file, options);
    if (created.status === 429) throw new AnalysisError("rate_limited");
    const info = await readJson(created);
    if (!created.ok || typeof info.id !== "string" || typeof info.token !== "string" || typeof info.uploadUrl !== "string") throw new AnalysisError("failed");
    remote = { id: info.id, token: info.token };

    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    const uploaded = await fetch(info.uploadUrl, { method: "PUT", headers: { "x-upsert": "false" }, body: form, signal });
    if (!uploaded.ok) throw new AnalysisError("failed");

    const res = await fetch(`/api/plans/${encodeURIComponent(remote.id)}/analyze`, { method: "POST", headers: { Authorization: `Bearer ${remote.token}` }, signal });
    if (res.status === 429) throw new AnalysisError("rate_limited");
    const out = await readJson(res);
    if (!res.ok) throw new AnalysisError("failed");
    const extraction = parseUntrustedExtraction(out.extraction);
    if (!extraction) throw new AnalysisError("failed");
    return {
      extraction,
      pages: typeof out.pages === "number" && out.pages >= 1 ? Math.min(20, Math.trunc(out.pages)) : 1,
      readAt: typeof out.readAt === "string" ? out.readAt : new Date().toISOString(),
      demo: false,
      remote,
    };
  } catch (e) {
    if (remote) void deleteRemotePlan(remote); // do not leave a file behind after a failed or cancelled run
    if (signal?.aborted) throw new AnalysisAborted();
    if (e instanceof AnalysisError || e instanceof AnalysisAborted) throw e;
    throw new AnalysisError("network");
  }
};

export const analyzePlan: PlanAnalyzer = apiAnalyzer;
