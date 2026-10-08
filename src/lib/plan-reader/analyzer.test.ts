import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalysisError, apiAnalyzer } from "./analyzer";

const file = new File([new Uint8Array(32)], "plan.pdf", { type: "application/pdf" });
const res = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
const extraction = { readable: true, units: "imperial", scaleText: null, rooms: [], warnings: [] };

afterEach(() => vi.unstubAllGlobals());

describe("apiAnalyzer", () => {
  it("falls back to the labelled demo when the server says not configured", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(503, { error: "not_configured" })));
    const r = await apiAnalyzer(file, { kind: "pdf" });
    expect(r.demo).toBe(true);
    expect(r.remote).toBeUndefined();
  });

  it("uploads, analyses and keeps the credentials in memory", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method} ${url}`);
        if (url === "/api/plans") return res(200, { id: "id-1", token: "t".repeat(43), uploadUrl: "https://example.supabase.co/up" });
        if (url.startsWith("https://example.supabase.co")) return res(200);
        return res(200, { extraction, pages: 2, readAt: "2026-10-05T12:00:00.000Z" });
      }),
    );
    const r = await apiAnalyzer(file, { kind: "pdf" });
    expect(r).toMatchObject({ demo: false, pages: 2, remote: { id: "id-1" } });
    expect(calls).toEqual(["POST /api/plans", "PUT https://example.supabase.co/up", "POST /api/plans/id-1/analyze"]);
  });

  it("maps 429 and deletes the upload after a failure", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method} ${url}`);
        if (url === "/api/plans") return res(200, { id: "id-2", token: "t".repeat(43), uploadUrl: "https://example.supabase.co/up" });
        if (url.startsWith("https://example.supabase.co")) return res(200);
        if (init?.method === "DELETE") return res(200);
        return res(429);
      }),
    );
    await expect(apiAnalyzer(file, { kind: "pdf" })).rejects.toMatchObject({ code: "rate_limited" } satisfies Partial<AnalysisError>);
    expect(calls).toContain("DELETE /api/plans/id-2");
  });

  it("rejects an extraction that does not validate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/plans") return res(200, { id: "id-3", token: "t".repeat(43), uploadUrl: "https://example.supabase.co/up" });
        if (url.startsWith("https://example.supabase.co")) return res(200);
        return res(200, { extraction: "not an object" });
      }),
    );
    await expect(apiAnalyzer(file, { kind: "pdf" })).rejects.toMatchObject({ code: "failed" });
  });
});
