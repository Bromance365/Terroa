/**
 * Client-side checks before a plan is accepted: size, MIME type AND magic bytes.
 * Convenience only: the server repeats them (HANDOFF 12, SECURITY_PRIVACY abuse case 4).
 * Nothing here logs the file name or contents.
 */

export const MAX_PLAN_BYTES = 20 * 1024 * 1024;

export type PlanFileKind = "pdf" | "jpeg" | "png";
export type PlanFileProblem = "type" | "size" | "heic";
export type PlanFileCheck = { ok: true; kind: PlanFileKind } | { ok: false; problem: PlanFileProblem };

const MIME_TO_KIND: Record<string, PlanFileKind> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpeg",
  "image/png": "png",
};

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((b, i) => bytes[offset + i] === b);
}

/** Kind from the first bytes, or "heic" for HEIF containers, or null. */
export function sniff(bytes: Uint8Array): PlanFileKind | "heic" | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "pdf"; // %PDF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "png";
  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) {
    // ISO base media "ftyp" box: brand at bytes 8-11.
    const brand = String.fromCharCode(...Array.from(bytes.slice(8, 12)));
    if (/^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(brand)) return "heic";
  }
  return null;
}

const looksHeic = (file: File) => /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

export async function validatePlanFile(file: File): Promise<PlanFileCheck> {
  if (looksHeic(file)) return { ok: false, problem: "heic" };
  if (file.size > MAX_PLAN_BYTES) return { ok: false, problem: "size" };
  if (file.size < 8) return { ok: false, problem: "type" };

  const claimed = file.type ? MIME_TO_KIND[file.type.toLowerCase()] : undefined;
  // An empty MIME type happens on some mobile pickers: then only the bytes decide.
  if (file.type && !claimed) return { ok: false, problem: "type" };

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  } catch {
    return { ok: false, problem: "type" };
  }
  const real = sniff(bytes);
  if (real === "heic") return { ok: false, problem: "heic" };
  if (!real || (claimed && claimed !== real)) return { ok: false, problem: "type" };
  return { ok: true, kind: real };
}
