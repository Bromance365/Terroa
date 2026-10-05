import { test } from "vitest";
import assert from "node:assert/strict";
import { areaToSqft, computeText, displayText } from "./units";
import { parsePlanImport } from "./planImport";

test("same unit shows the typed text untouched", () => {
  assert.equal(displayText({ v: "18,2", u: "imperial" }, "len", "imperial"), "18,2");
});

test("converts for display only and round-trips without drift", () => {
  const x = { v: "12", u: "imperial" as const };
  assert.equal(displayText(x, "len", "metric"), "3,66");
  assert.equal(displayText(x, "len", "metric", "."), "3.66");
  // The stored value is untouched, so going back shows exactly what was typed.
  assert.equal(displayText(x, "len", "imperial"), "12");
  assert.equal(displayText({ v: "24", u: "imperial" }, "small", "metric"), "610");
  assert.equal(displayText({ v: "20", u: "imperial" }, "area", "metric"), "1,86");
});

test("computing uses full precision, not the rounded display", () => {
  assert.equal(Number(computeText({ v: "12", u: "imperial" }, "len", "metric")), 12 * 0.3048);
  assert.equal(computeText({ v: "abc", u: "imperial" }, "len", "metric"), "abc");
});

test("area to sq ft", () => {
  assert.equal(areaToSqft(100, "imperial"), 100);
  assert.ok(Math.abs(areaToSqft(9.290304, "metric") - 100) < 1e-9);
});

test("plan import accepts valid data and ignores invalid data", () => {
  const ok = parsePlanImport(JSON.stringify({ file: "RDC", rooms: [{ name: "Salon", lengthFt: 18.2, widthFt: 14 }] }));
  assert.equal(ok?.file, "RDC");
  assert.deepEqual(ok?.rooms[0].length, { v: "18.2", u: "imperial" });
  assert.equal(parsePlanImport(null), null);
  assert.equal(parsePlanImport("{not json"), null);
  assert.equal(parsePlanImport(JSON.stringify({ file: "x", rooms: [{ name: "a", lengthFt: -1, widthFt: 3 }] })), null);
  assert.equal(parsePlanImport(JSON.stringify({ file: "x", rooms: [] })), null);
  assert.equal(parsePlanImport(JSON.stringify({ file: "x", rooms: [{ name: "a", lengthFt: 5000, widthFt: 3 }] })), null);
});
