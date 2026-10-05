import { z } from "zod";
import { LIMITS } from "@/lib/quantities";
import type { Typed } from "./units";

/** sessionStorage key the plan reader writes when sending verified rooms to the calculator. */
export const PLAN_IMPORT_KEY = "terroa.planImport.v1";

const planImportSchema = z.object({
  file: z.string().trim().min(1).max(80),
  rooms: z
    .array(
      z.object({
        name: z.string().trim().max(60),
        lengthFt: z.number().positive().max(LIMITS.maxDimensionFt),
        widthFt: z.number().positive().max(LIMITS.maxDimensionFt),
      }),
    )
    .min(1)
    .max(LIMITS.maxRooms),
});

export interface ImportedRoom {
  name: string;
  length: Typed;
  width: Typed;
}

const feet = (n: number): Typed => ({ v: String(Math.round(n * 100) / 100), u: "imperial" });

/** Validates untrusted JSON from sessionStorage. Returns null for anything invalid (ignored silently). */
export function parsePlanImport(raw: string | null): { file: string; rooms: ImportedRoom[] } | null {
  if (!raw) return null;
  try {
    const parsed = planImportSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    return {
      file: parsed.data.file,
      rooms: parsed.data.rooms.map((r) => ({ name: r.name, length: feet(r.lengthFt), width: feet(r.widthFt) })),
    };
  } catch {
    return null;
  }
}
