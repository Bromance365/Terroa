import { describe, expect, it } from "vitest";
import {
  buildMask,
  dedupe,
  detectRoom,
  detectRoomOutcome,
  dilate,
  erode,
  floodRoom,
  openMask,
  orthogonalize,
  otsuThreshold,
  prepareWalls,
  rdp,
  stripAnnotation,
  toGray,
  traceContour,
  type Bitmap,
  type Mask,
} from "./detect";
import { polygonArea } from "./geometry";

// Synthetic plans -----------------------------------------------------------------------------

function blank(width: number, height: number, value = 255): Bitmap {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  if (value !== 255) for (let i = 0; i < data.length; i += 4) data[i] = data[i + 1] = data[i + 2] = value;
  return { data, width, height };
}

function rect(img: Bitmap, x0: number, y0: number, x1: number, y1: number, value = 0) {
  for (let y = Math.max(0, y0); y < Math.min(img.height, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(img.width, x1); x++) {
      const i = (y * img.width + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = value;
    }
  }
}

interface PlanOptions {
  interiorDoor?: boolean;
  exteriorDoor?: boolean;
  frame?: boolean;
  annotations?: boolean;
}

/**
 * Two rooms side by side inside 4 px walls: A = x 44..198, B = x 202..356, both y 44..256 (154 x 212 = 32648 px each).
 * The doors are 20 px wide cut-outs in the middle wall (y 120..140) and the right wall (y 100..120).
 */
function twoRoomPlan({ interiorDoor = true, exteriorDoor = true, frame = false, annotations = true }: PlanOptions = {}): Bitmap {
  const img = blank(400, 300);
  if (frame) {
    rect(img, 5, 5, 395, 8);
    rect(img, 5, 292, 395, 295);
    rect(img, 5, 5, 8, 295);
    rect(img, 392, 5, 395, 295);
  }
  rect(img, 40, 40, 360, 44); // top
  rect(img, 40, 256, 360, 260); // bottom
  rect(img, 40, 40, 44, 260); // left
  rect(img, 356, 40, 360, 260); // right
  rect(img, 198, 44, 202, 256); // middle
  if (interiorDoor) rect(img, 198, 120, 202, 140, 255);
  if (exteriorDoor) rect(img, 356, 100, 360, 120, 255);
  if (annotations) {
    rect(img, 80, 100, 130, 101); // 1 px dimension line inside A
    rect(img, 90, 90, 91, 110);
    rect(img, 240, 150, 242, 190); // 2 px mark inside B
  }
  return img;
}

const A_AREA = 154 * 212;
const SEED_A = { x: 120, y: 200 };
const SEED_B = { x: 280, y: 200 };
const within = (value: number, expected: number, tolerance: number) => Math.abs(value - expected) <= tolerance * expected;

describe("threshold and mask", () => {
  it("toGray treats transparent pixels as paper", () => {
    const img: Bitmap = { data: new Uint8Array([0, 0, 0, 0, 0, 0, 0, 255]), width: 2, height: 1 };
    expect(Array.from(toGray(img))).toEqual([255, 0]);
  });
  it("Otsu separates a bimodal histogram", () => {
    const gray = new Uint8Array(1000).fill(240);
    gray.fill(30, 0, 200);
    const t = otsuThreshold(gray);
    expect(t).toBeGreaterThanOrEqual(30);
    expect(t).toBeLessThan(240);
  });
  it("buildMask marks walls and reports the wall share", () => {
    const m = buildMask(twoRoomPlan());
    expect(m).not.toBeNull();
    expect(m!.wallFraction).toBeGreaterThan(0.03);
    expect(m!.wallFraction).toBeLessThan(0.2);
    expect(m!.mask.data[42 * 400 + 100]).toBe(1);
    expect(m!.mask.data[150 * 400 + 100]).toBe(0);
  });
  it("buildMask refuses malformed bitmaps", () => {
    expect(buildMask({ data: new Uint8Array(4), width: 10, height: 10 })).toBeNull();
    expect(buildMask({ data: new Uint8Array(0), width: 0, height: 0 })).toBeNull();
    expect(buildMask({ data: new Uint8Array(16), width: 2.5, height: 2 })).toBeNull();
  });
});

describe("morphology", () => {
  const dot = (): Mask => {
    const data = new Uint8Array(11 * 11);
    data[5 * 11 + 5] = 1;
    return { data, width: 11, height: 11 };
  };
  it("dilate grows by the radius and erode takes it back", () => {
    const d = dilate(dot(), 2);
    expect(d.data.reduce((s, v) => s + v, 0)).toBe(25);
    const e = erode(d, 2);
    expect(e.data.reduce((s, v) => s + v, 0)).toBe(1);
  });
  it("opening removes thin marks and keeps thick walls", () => {
    const m = buildMask(twoRoomPlan())!.mask;
    const stripped = stripAnnotation(m);
    expect(m.data[100 * 400 + 100]).toBe(1); // 1 px line is in the raw mask
    expect(stripped.data[100 * 400 + 100]).toBe(0); // and gone after the opening
    expect(stripped.data[42 * 400 + 100]).toBe(1); // wall stays
    expect(openMask(m, 0)).toBe(m);
  });
});

describe("contour, simplification", () => {
  it("traces a solid rectangle to its exact area", () => {
    const w = 30;
    const h = 20;
    const region = new Uint8Array(w * h);
    for (let y = 5; y < 15; y++) for (let x = 4; x < 24; x++) region[y * w + x] = 1;
    const ring = traceContour(region, w, h);
    expect(ring).toHaveLength(4);
    expect(polygonArea(ring)).toBe(200);
  });
  it("traces an L shape exactly", () => {
    const w = 20;
    const h = 20;
    const region = new Uint8Array(w * h);
    for (let y = 2; y < 12; y++) for (let x = 2; x < 12; x++) if (!(x >= 7 && y >= 7)) region[y * w + x] = 1;
    expect(polygonArea(traceContour(region, w, h))).toBe(75);
    expect(traceContour(new Uint8Array(100), 10, 10)).toEqual([]);
  });
  it("RDP drops wobble within tolerance and keeps corners", () => {
    const ring = [];
    for (let x = 0; x <= 100; x += 2) ring.push({ x, y: x % 4 === 0 ? 0 : 1 });
    for (let y = 2; y <= 60; y += 2) ring.push({ x: 100, y });
    for (let x = 98; x >= 0; x -= 2) ring.push({ x, y: 60 });
    for (let y = 58; y >= 2; y -= 2) ring.push({ x: 0, y });
    const out = rdp(ring, 2.2);
    expect(out.length).toBeLessThanOrEqual(6);
    expect(out.length).toBeGreaterThanOrEqual(4);
    expect(within(polygonArea(out), 6000, 0.03)).toBe(true);
  });
  it("orthogonalize squares near-axis edges including the closing edge", () => {
    const sq = orthogonalize([{ x: 0, y: 0 }, { x: 100, y: 3 }, { x: 102, y: 80 }, { x: 1, y: 82 }]);
    expect(sq[0]!.y).toBeCloseTo(sq[1]!.y, 6);
    expect(sq[1]!.x).toBeCloseTo(sq[2]!.x, 6);
    expect(sq[2]!.y).toBeCloseTo(sq[3]!.y, 6);
    expect(sq[3]!.x).toBeCloseTo(sq[0]!.x, 6);
  });
  it("dedupe removes repeats and collinear vertices", () => {
    const out = dedupe([{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]);
    expect(out).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]);
  });
});

describe("room detection on a synthetic two-room plan", () => {
  it("detects a closed room: right area, four corners", () => {
    const img = twoRoomPlan({ interiorDoor: false, exteriorDoor: false });
    const room = detectRoom(img, SEED_A, { gapRadius: 4 });
    expect(room).not.toBeNull();
    expect(room!.points).toHaveLength(4);
    expect(within(room!.areaPx, A_AREA, 0.02)).toBe(true);
  });

  it("without bridging, an open doorway lets the fill escape (here through the exterior door)", () => {
    const outcome = detectRoomOutcome(twoRoomPlan(), SEED_A, { gapRadius: 2 });
    expect(outcome).toEqual({ ok: false, reason: "leak" });
  });

  it("with a bridging radius over half the door width the open-door room is found at its real size", () => {
    const img = twoRoomPlan();
    const a = detectRoom(img, SEED_A, { gapRadius: 12 });
    expect(a).not.toBeNull();
    expect(within(a!.areaPx, A_AREA, 0.03)).toBe(true);
    const b = detectRoom(img, SEED_B, { gapRadius: 12 });
    expect(b).not.toBeNull();
    expect(within(b!.areaPx, A_AREA, 0.03)).toBe(true);
    // The two answers do not overlap: each polygon sits on its own side of the middle wall.
    const xs = a!.points.map((p) => p.x);
    expect(Math.max(...xs)).toBeLessThanOrEqual(200);
  });

  it("the automatic sweep finds the room without being told the door width", () => {
    const img = twoRoomPlan();
    const room = detectRoom(img, SEED_A);
    expect(room).not.toBeNull();
    expect(within(room!.areaPx, A_AREA, 0.04)).toBe(true);
    expect(room!.gapRadius).toBeGreaterThanOrEqual(10);
  });

  it("converts to the expected square footage with a scale", () => {
    const room = detectRoom(twoRoomPlan(), SEED_A, { gapRadius: 12 })!;
    const pxPerFt = 10; // 154 x 212 px -> 15.4 x 21.2 ft = 326.48 sq ft
    const sqft = room.areaPx / (pxPerFt * pxPerFt);
    expect(Math.abs(sqft - 326.48) / 326.48).toBeLessThan(0.03);
  });

  it("rejects the whole-page outside region", () => {
    const img = twoRoomPlan();
    expect(detectRoom(img, { x: 10, y: 10 }, { gapRadius: 12 })).toBeNull();
    expect(detectRoom(img, { x: 10, y: 10 })).toBeNull();
    expect(detectRoomOutcome(img, { x: 10, y: 10 }, { gapRadius: 12 })).toEqual({ ok: false, reason: "leak" });
  });

  it("rejects the margin inside a drawing frame (page-sized outline)", () => {
    const img = twoRoomPlan({ frame: true, interiorDoor: false, exteriorDoor: false });
    const out = detectRoomOutcome(img, { x: 20, y: 150 }, { gapRadius: 4 });
    expect(out).toEqual({ ok: false, reason: "too-large" });
    // The room inside the building is still fine.
    expect(detectRoom(img, SEED_A, { gapRadius: 4 })).not.toBeNull();
  });

  it("returns null for a seed outside the bitmap or not finite", () => {
    const img = twoRoomPlan();
    expect(detectRoom(img, { x: -5, y: 10 }, { gapRadius: 4 })).toBeNull();
    expect(detectRoom(img, { x: 1000, y: 10 }, { gapRadius: 4 })).toBeNull();
    expect(detectRoom(img, { x: NaN, y: 10 }, { gapRadius: 4 })).toBeNull();
  });

  it("reuses prepared walls and gives the same answer", () => {
    const img = twoRoomPlan();
    const prepared = prepareWalls(img)!;
    const a = detectRoom(img, SEED_A, { gapRadius: 12, walls: prepared.walls })!;
    const b = detectRoom(img, SEED_A, { gapRadius: 12 })!;
    expect(a.areaPx).toBe(b.areaPx);
  });

  it("a room that is too small for a room is not returned", () => {
    const img = blank(200, 200);
    rect(img, 50, 50, 74, 54);
    rect(img, 50, 70, 74, 74);
    rect(img, 50, 50, 54, 74);
    rect(img, 70, 50, 74, 74);
    expect(detectRoomOutcome(img, { x: 62, y: 62 }, { gapRadius: 0 })).toEqual({ ok: false, reason: "tiny" });
  });

  it("floodRoom reports the walls it was given, without a bitmap", () => {
    const walls = stripAnnotation(buildMask(twoRoomPlan({ interiorDoor: false, exteriorDoor: false }))!.mask);
    const out = floodRoom(walls, SEED_B, { gapRadius: 0, orthogonal: false });
    expect(out.ok).toBe(true);
    if (out.ok) expect(within(out.pixels, A_AREA, 0.001)).toBe(true);
  });
});

describe("bounded work on bad input", () => {
  it("blank white sheet returns null at once", () => {
    const start = Date.now();
    expect(detectRoom(blank(1200, 900), { x: 600, y: 450 })).toBeNull();
    expect(detectRoomOutcome(blank(300, 300), { x: 100, y: 100 })).toEqual({ ok: false, reason: "blank" });
    expect(Date.now() - start).toBeLessThan(2000);
  });
  it("all-black sheet returns null (the seed is inside a wall)", () => {
    expect(detectRoom(blank(200, 200, 0), { x: 100, y: 100 })).toBeNull();
  });
  it("noise terminates and never claims a page-sized room", () => {
    const img = blank(300, 300);
    let s = 12345;
    for (let i = 0; i < 300 * 300; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const v = s % 100 < 40 ? 0 : 255;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    }
    const start = Date.now();
    const out = detectRoom(img, { x: 150, y: 150 });
    expect(Date.now() - start).toBeLessThan(10000);
    if (out) expect(out.areaPx).toBeLessThan(0.5 * 300 * 300);
  });
  it("a tiny work budget stops the sweep", () => {
    const out = detectRoomOutcome(twoRoomPlan(), SEED_A, { budget: 100 });
    expect(out.ok).toBe(false);
  });
  it("oversized or inconsistent bitmaps are refused", () => {
    expect(detectRoom({ data: new Uint8ClampedArray(16), width: 5000, height: 5000 }, { x: 1, y: 1 })).toBeNull();
    expect(detectRoomOutcome({ data: new Uint8ClampedArray(16), width: 5000, height: 5000 }, { x: 1, y: 1 })).toEqual({ ok: false, reason: "bad-image" });
  });
});
