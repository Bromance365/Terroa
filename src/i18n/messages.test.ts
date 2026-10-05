import { describe, expect, it } from "vitest";
import fr from "../../messages/fr-CA.json";
import en from "../../messages/en-CA.json";

function flatten(o: Record<string, unknown>, prefix = ""): Record<string, string> {
  return Object.entries(o).reduce<Record<string, string>>((acc, [k, v]) => {
    if (typeof v === "object" && v !== null) Object.assign(acc, flatten(v as Record<string, unknown>, `${prefix}${k}.`));
    else acc[`${prefix}${k}`] = String(v);
    return acc;
  }, {});
}

const f = flatten(fr);
const e = flatten(en);
// ICU argument names, e.g. {count}, {name}; plural bodies are ignored.
const args = (s: string) => [...s.matchAll(/\{(\w+)(?:\}|,\s*(?:plural|select|selectordinal|number|date|time))/g)].map((m) => m[1]).sort();

describe("messages", () => {
  it("FR and EN have the same keys", () => {
    expect(Object.keys(f).sort()).toEqual(Object.keys(e).sort());
  });

  it("FR and EN use the same ICU arguments", () => {
    const mismatched = Object.keys(f).filter((k) => JSON.stringify(args(f[k]!)) !== JSON.stringify(args(e[k]!)));
    expect(mismatched).toEqual([]);
  });

  it("has no empty strings and no exclamation marks", () => {
    for (const [k, v] of [...Object.entries(f), ...Object.entries(e)]) {
      if (k === "_meta") continue;
      expect(v.trim(), k).not.toBe("");
      expect(v, k).not.toMatch(/!/);
    }
  });
});
