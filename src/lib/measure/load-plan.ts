import { validatePlanFile, type PlanFileKind, type PlanFileProblem } from "@/lib/plan-reader/validate-file";

/**
 * Loads a plan (PDF, PNG or JPG) into a canvas, in the browser only. Nothing is uploaded: no fetch, no storage.
 * pdf.js is imported on demand (it is large) and its worker is a same-origin module worker, which the site CSP
 * (default-src 'self', no blob: workers) allows.
 */

export const MAX_PDF_PAGES = 10;
/** Long side of the rendered plan, in pixels. */
export const MAX_RENDER_SIDE = 3000;
/** PDF pages are rendered so their long side lands here (then capped by MAX_RENDER_SIDE). */
const TARGET_PDF_SIDE = 2400;
/** Images above this many pixels are refused before decoding to a canvas (decompression bombs). */
const MAX_IMAGE_PIXELS = 120_000_000;

export type PlanLoadError = PlanFileProblem | "decode" | "too-large" | "pdf" | "pdf-password";

export class PlanLoadFailure extends Error {
  constructor(readonly code: PlanLoadError) {
    super(code);
    this.name = "PlanLoadFailure";
  }
}

export interface LoadedPlan {
  kind: PlanFileKind;
  /** The rendered page or image. Drawn as is, and read for detection. */
  canvas: HTMLCanvasElement;
  /** Pages available (at most MAX_PDF_PAGES). 1 for images. */
  pageCount: number;
  /** True when the PDF has more pages than MAX_PDF_PAGES. */
  truncated: boolean;
  /** Renders another page of a PDF. */
  renderPage: (page: number) => Promise<HTMLCanvasElement>;
  /** Frees the PDF document and the worker. */
  destroy: () => void;
}

function newCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return canvas;
}

function paintWhite(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PlanLoadFailure("decode");
  ctx.fillStyle = "white"; // paper behind the raster, not a UI colour
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return ctx;
}

async function loadImage(file: File, kind: PlanFileKind): Promise<LoadedPlan> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new PlanLoadFailure("decode"));
      el.src = url;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) throw new PlanLoadFailure("decode");
    if (w * h > MAX_IMAGE_PIXELS) throw new PlanLoadFailure("too-large");
    const ratio = Math.min(1, MAX_RENDER_SIDE / Math.max(w, h));
    const canvas = newCanvas(w * ratio, h * ratio);
    const ctx = paintWhite(canvas);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { kind, canvas, pageCount: 1, truncated: false, renderPage: async () => canvas, destroy: () => undefined };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadPdf(file: File): Promise<LoadedPlan> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Legacy build: pdf.js 6 needs very recent JS features (Map.getOrInsertComputed); the legacy build runs on current browsers.
  // Same-origin module worker (not a blob: URL).
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data, enableXfa: false });
  let doc;
  try {
    doc = await task.promise;
  } catch (e) {
    void task.destroy();
    throw new PlanLoadFailure(e instanceof Error && e.name === "PasswordException" ? "pdf-password" : "pdf");
  }
  const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES);
  let destroyed = false;

  const renderPage = async (n: number) => {
    if (destroyed) throw new PlanLoadFailure("pdf");
    const page = await doc.getPage(Math.min(pageCount, Math.max(1, Math.trunc(n))));
    const base = page.getViewport({ scale: 1 });
    const long = Math.max(base.width, base.height);
    if (!(long > 0)) throw new PlanLoadFailure("pdf");
    const scale = Math.min(MAX_RENDER_SIDE, TARGET_PDF_SIDE) / long;
    const viewport = page.getViewport({ scale });
    const canvas = newCanvas(viewport.width, viewport.height);
    const ctx = paintWhite(canvas);
    try {
      await page.render({ canvas, canvasContext: ctx, viewport, background: "rgb(255,255,255)" }).promise;
    } catch {
      throw new PlanLoadFailure("pdf");
    } finally {
      page.cleanup();
    }
    return canvas;
  };

  const canvas = await renderPage(1);
  return {
    kind: "pdf",
    canvas,
    pageCount,
    truncated: doc.numPages > MAX_PDF_PAGES,
    renderPage,
    destroy: () => {
      destroyed = true;
      void task.destroy();
    },
  };
}

/** Validates (type, size, magic bytes: the plan reader's own check) then renders. Throws PlanLoadFailure. */
export async function loadPlanFile(file: File): Promise<LoadedPlan> {
  const check = await validatePlanFile(file);
  if (!check.ok) throw new PlanLoadFailure(check.problem);
  return check.kind === "pdf" ? loadPdf(file) : loadImage(file, check.kind);
}
