import { FT_TO_M, IN_TO_MM, SQFT_TO_M2, parsePositiveDecimal, type UnitSystem } from "@/lib/quantities";

/**
 * A value as typed by the person, with the unit system it was typed in.
 * Switching the unit toggle converts what is displayed and computed, never what is stored,
 * so switching back and forth cannot drift.
 */
export interface Typed {
  v: string;
  u: UnitSystem;
}

/** len: ft <-> m, area: sq ft <-> m², small: in <-> mm. */
export type UnitKind = "len" | "area" | "small";

const FACTOR: Record<UnitKind, number> = { len: FT_TO_M, area: SQFT_TO_M2, small: IN_TO_MM };
/** Fraction digits of a converted value shown in an input. */
const DIGITS: Record<UnitKind, number> = { len: 2, area: 2, small: 0 };

/** Imperial -> metric multiplies by the factor; metric -> imperial divides. */
export function convertNumber(n: number, kind: UnitKind, from: UnitSystem, to: UnitSystem): number {
  if (from === to) return n;
  return to === "metric" ? n * FACTOR[kind] : n / FACTOR[kind];
}

/** Text shown in an input: the typed text untouched when the unit matches, a rounded conversion otherwise. */
export function displayText(x: Typed, kind: UnitKind, to: UnitSystem, decimalSeparator: "," | "." = ","): string {
  if (x.u === to) return x.v;
  const n = parsePositiveDecimal(x.v);
  if (n === null) return x.v;
  const p = 10 ** DIGITS[kind];
  const rounded = Math.round(convertNumber(n, kind, x.u, to) * p) / p;
  return String(rounded).replace(".", decimalSeparator);
}

/** Full-precision string fed to the quantity maths (the rounded display text is never used for computing). */
export function computeText(x: Typed, kind: UnitKind, to: UnitSystem): string {
  if (x.u === to) return x.v;
  const n = parsePositiveDecimal(x.v);
  if (n === null) return x.v;
  return String(convertNumber(n, kind, x.u, to));
}

/** Area in the given system -> sq ft. */
export const areaToSqft = (area: number, units: UnitSystem): number => (units === "imperial" ? area : area / SQFT_TO_M2);
