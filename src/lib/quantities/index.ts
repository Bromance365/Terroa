/**
 * Quantity maths for the Terroa calculator, plan reader and quote basket.
 * Pure functions, no I/O: the same module runs in the browser (live results)
 * and on the server (re-computed before a quote request is stored — never trust client totals).
 *
 * Mirrors the behaviour of the Calculator artboard on the design canvas:
 * - order area = net area + waste, rounded UP (1 sq ft in imperial, 0.1 m² in metric)
 * - boxes = order area / coverage per box, rounded UP
 * - panels = per wall, ceil(width / panel width) x ceil(height / panel height)
 */

export type UnitSystem = 'imperial' | 'metric';

export const FT_TO_M = 0.3048;
export const SQFT_TO_M2 = 0.09290304;
export const IN_TO_MM = 25.4;

export const LIMITS = {
  /** Largest single dimension accepted (ft in imperial, converted for metric). */
  maxDimensionFt: 1000,
  /** Largest total net area accepted for one calculation. */
  maxAreaSqft: 100000,
  maxRooms: 60,
  maxWalls: 30,
  wasteOptions: [5, 10, 15] as const,
};

const EPSILON = 1e-9;

/**
 * Parse a number typed by a person in French or English: "18,2", "18.2", "1 012,5", "12.".
 * Spaces, no-break spaces and narrow no-break spaces are ignored.
 * Returns null for anything that is not a strictly positive finite number (no exponents, no signs).
 */
export function parsePositiveDecimal(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) && input > 0 ? input : null;
  const compact = input.replace(/[\s  ]/g, '');
  if (!/^(\d+([.,]\d*)?|[.,]\d+)$/.test(compact)) return null;
  const value = Number(compact.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Round up to the given step without float drift (e.g. 110.00000000000001 stays 110). */
export function ceilToStep(value: number, step: number): number {
  const inverse = 1 / step;
  return Math.ceil(value * inverse - EPSILON) / inverse;
}

export type DimensionError = 'invalid' | 'too-large';

export interface RoomInput {
  id: string;
  name: string;
  /** As typed, in feet (imperial) or metres (metric). */
  length: string;
  width: string;
}

export interface RoomResult {
  id: string;
  /** Area in sq ft (imperial) or m² (metric); null when a dimension is invalid. */
  area: number | null;
  lengthError: DimensionError | null;
  widthError: DimensionError | null;
}

export interface FloorInput {
  rooms: RoomInput[];
  /** Waste percentage, one of LIMITS.wasteOptions. */
  wastePct: number;
  /** Coverage of one box, as typed, in sq ft (imperial) or m² (metric). Comes from the product sheet. */
  coveragePerBox: string;
  units: UnitSystem;
}

export interface FloorResult {
  rooms: RoomResult[];
  netArea: number;
  orderArea: number;
  /** Null when the coverage per box is missing or invalid. */
  boxes: number | null;
  /** orderArea expressed in the other unit system (m² for imperial, sq ft for metric). */
  orderAreaOtherUnit: number;
  tooLarge: boolean;
  units: UnitSystem;
}

function checkDimension(raw: string, units: UnitSystem): { value: number | null; error: DimensionError | null } {
  const value = parsePositiveDecimal(raw);
  if (value === null) return { value: null, error: 'invalid' };
  const maxDim = units === 'imperial' ? LIMITS.maxDimensionFt : LIMITS.maxDimensionFt * FT_TO_M;
  if (value > maxDim) return { value: null, error: 'too-large' };
  return { value, error: null };
}

export function floorQuantities(input: FloorInput): FloorResult {
  const { units } = input;
  if (!LIMITS.wasteOptions.includes(input.wastePct as 5 | 10 | 15)) {
    throw new RangeError(`wastePct must be one of ${LIMITS.wasteOptions.join(', ')}`);
  }
  const rooms = input.rooms.slice(0, LIMITS.maxRooms).map((room): RoomResult => {
    const length = checkDimension(room.length, units);
    const width = checkDimension(room.width, units);
    const area = length.value !== null && width.value !== null ? length.value * width.value : null;
    return { id: room.id, area, lengthError: length.error, widthError: width.error };
  });

  const netArea = rooms.reduce((sum, r) => sum + (r.area ?? 0), 0);
  const maxArea = units === 'imperial' ? LIMITS.maxAreaSqft : LIMITS.maxAreaSqft * SQFT_TO_M2;
  const tooLarge = netArea > maxArea;
  const step = units === 'imperial' ? 1 : 0.1;
  const orderArea = netArea > 0 && !tooLarge ? ceilToStep(netArea * (1 + input.wastePct / 100), step) : 0;

  const coverage = parsePositiveDecimal(input.coveragePerBox);
  const boxes = coverage !== null && orderArea > 0 ? Math.ceil(orderArea / coverage - EPSILON) : null;

  const orderAreaOtherUnit = units === 'imperial' ? orderArea * SQFT_TO_M2 : orderArea / SQFT_TO_M2;

  return { rooms, netArea, orderArea, boxes, orderAreaOtherUnit, tooLarge, units };
}

export interface WallInput {
  id: string;
  name: string;
  /** As typed, in feet (imperial) or metres (metric). */
  width: string;
  height: string;
}

export interface PanelInput {
  walls: WallInput[];
  /** Panel size as typed, in inches (imperial) or millimetres (metric). Comes from the product sheet. */
  panelWidth: string;
  panelHeight: string;
  units: UnitSystem;
}

export interface WallResult {
  id: string;
  panels: number | null;
  area: number | null;
  widthError: DimensionError | null;
  heightError: DimensionError | null;
}

export interface PanelResult {
  walls: WallResult[];
  panels: number;
  /** Wall area in sq ft (imperial) or m² (metric). */
  wallArea: number;
  panelSizeValid: boolean;
}

export function panelQuantities(input: PanelInput): PanelResult {
  const { units } = input;
  const toSmall = units === 'imperial' ? 12 : 1000; // ft -> in, m -> mm
  const pw = parsePositiveDecimal(input.panelWidth);
  const ph = parsePositiveDecimal(input.panelHeight);
  const panelSizeValid = pw !== null && ph !== null;

  const walls = input.walls.slice(0, LIMITS.maxWalls).map((wall): WallResult => {
    const width = checkDimension(wall.width, units);
    const height = checkDimension(wall.height, units);
    if (width.value === null || height.value === null || !panelSizeValid) {
      return { id: wall.id, panels: null, area: null, widthError: width.error, heightError: height.error };
    }
    const across = Math.ceil((width.value * toSmall) / (pw as number) - EPSILON);
    const up = Math.ceil((height.value * toSmall) / (ph as number) - EPSILON);
    return { id: wall.id, panels: across * up, area: width.value * height.value, widthError: null, heightError: null };
  });

  return {
    walls,
    panels: walls.reduce((sum, w) => sum + (w.panels ?? 0), 0),
    wallArea: walls.reduce((sum, w) => sum + (w.area ?? 0), 0),
    panelSizeValid,
  };
}

/** "1 039" / "96,5" — French Canadian number formatting for display. */
export function formatFr(value: number, maxFractionDigits = 1): string {
  return value.toLocaleString('fr-CA', { minimumFractionDigits: 0, maximumFractionDigits: maxFractionDigits });
}

/** "1,039" / "96.5" — English Canadian number formatting for display. */
export function formatEn(value: number, maxFractionDigits = 1): string {
  return value.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: maxFractionDigits });
}

/** French plural for counts: 0 and 1 take the singular ("0 boîte", "1 boîte", "2 boîtes"). */
export function pluralFr(count: number, singular: string, plural: string): string {
  return `${formatFr(count, 0)} ${count > 1 ? plural : singular}`;
}
