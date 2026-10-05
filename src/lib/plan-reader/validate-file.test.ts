import { describe, expect, it } from "vitest";
import { MAX_PLAN_BYTES, validatePlanFile } from "./validate-file";

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const file = (data: BlobPart, name: string, type: string) => new File([data], name, { type });
const ftyp = (brand: string) => new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, ...Array.from(brand).map((c) => c.charCodeAt(0)), 0, 0, 0, 0]);

describe("validatePlanFile", () => {
  it("accepts PDF, JPEG and PNG by MIME and magic bytes", async () => {
    expect(await validatePlanFile(file(bytes(0x25, 0x50, 0x44, 0x46), "a.pdf", "application/pdf"))).toEqual({ ok: true, kind: "pdf" });
    expect(await validatePlanFile(file(bytes(0xff, 0xd8, 0xff), "a.jpg", "image/jpeg"))).toEqual({ ok: true, kind: "jpeg" });
    expect(await validatePlanFile(file(bytes(0x89, 0x50, 0x4e, 0x47), "a.png", "image/png"))).toEqual({ ok: true, kind: "png" });
  });
  it("accepts an empty MIME type when the bytes are right", async () => {
    expect(await validatePlanFile(file(bytes(0x25, 0x50, 0x44, 0x46), "a.pdf", ""))).toEqual({ ok: true, kind: "pdf" });
  });
  it("rejects a renamed file (bytes do not match)", async () => {
    expect(await validatePlanFile(file("<svg onload=alert(1)>", "a.pdf", "application/pdf"))).toEqual({ ok: false, problem: "type" });
    expect(await validatePlanFile(file(bytes(0xff, 0xd8, 0xff), "a.png", "image/png"))).toEqual({ ok: false, problem: "type" });
    expect(await validatePlanFile(file("<html>", "a.html", ""))).toEqual({ ok: false, problem: "type" });
  });
  it("rejects other MIME types even with good bytes", async () => {
    expect(await validatePlanFile(file(bytes(0x25, 0x50, 0x44, 0x46), "a.svg", "image/svg+xml"))).toEqual({ ok: false, problem: "type" });
  });
  it("rejects HEIC by MIME, extension or bytes", async () => {
    expect(await validatePlanFile(file(ftyp("heic"), "IMG.HEIC", "image/heic"))).toEqual({ ok: false, problem: "heic" });
    expect(await validatePlanFile(file(ftyp("heic"), "IMG.jpg", "image/jpeg"))).toEqual({ ok: false, problem: "heic" });
    expect(await validatePlanFile(file("x", "IMG.heif", ""))).toEqual({ ok: false, problem: "heic" });
  });
  it("rejects files over 20 MB and empty files", async () => {
    const big = new File([new Uint8Array(MAX_PLAN_BYTES + 1)], "big.pdf", { type: "application/pdf" });
    expect(await validatePlanFile(big)).toEqual({ ok: false, problem: "size" });
    expect(await validatePlanFile(file("", "a.pdf", "application/pdf"))).toEqual({ ok: false, problem: "type" });
  });
});
