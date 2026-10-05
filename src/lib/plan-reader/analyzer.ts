import planSample from "@data/plan-sample.json";
import type { Locale } from "@/i18n/routing";
import { parseUntrustedExtraction, type Extraction } from "./types";

export interface AnalyzeOptions {
  signal?: AbortSignal;
  /** Mock only: "unreadable" forces the unreadable state (URL `?demo=unreadable`). */
  demo?: "unreadable" | null;
  locale?: Locale;
}

export interface AnalysisResult {
  /** Validated and cleaned model output. Never contains areas: those are recomputed in compute.ts. */
  extraction: Extraction;
  pages: number;
  /** ISO timestamp of the reading. */
  readAt: string;
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
    hints: { productId: planSample.rooms.map((r) => r.product), included: planSample.rooms.map((r) => r.included) },
  };
};

/**
 * PHASE 3 SWAP (one line): replace `mockAnalyzer` below with a function that POSTs the file to
 * `/api/plans` (signed upload), then `POST /api/plans/{id}/analyze` with the upload token, and returns the
 * server's validated rooms as an AnalysisResult. The UI only depends on this export.
 */
export const analyzePlan: PlanAnalyzer = mockAnalyzer;
