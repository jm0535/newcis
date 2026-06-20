// tests/data-confidence.test.ts
import { describe, it, expect } from "vitest";
import { dataConfidence } from "../src/lib/data-confidence";
import type { LastRun } from "../src/lib/types";

function lastRun(sources: Record<string, boolean>): LastRun {
  return {
    started_at: "2026-06-20T00:00:00.000Z",
    finished_at: "2026-06-20T00:05:00.000Z",
    status: "partial",
    sources_ok: sources,
    notes: "",
  };
}

describe("dataConfidence", () => {
  it("GOOD when at least 75% of feeds reported", () => {
    const r = dataConfidence(lastRun({ a: true, b: true, c: true, d: false }));
    expect(r.level).toBe("GOOD");
    expect(r.line).toContain("3 of 4 data feeds reported");
    expect(r.line).toContain("DEMO");
    expect(r.feeds).toEqual([
      { name: "a", ok: true },
      { name: "b", ok: true },
      { name: "c", ok: true },
      { name: "d", ok: false },
    ]);
  });

  it("PARTIAL between 40% and 75%", () => {
    const r = dataConfidence(lastRun({ a: true, b: false, c: false }));
    expect(r.level).toBe("PARTIAL");
    expect(r.line).toContain("1 of 3 data feeds reported");
  });

  it("LOW below 40%", () => {
    const r = dataConfidence(lastRun({ a: true, b: false, c: false, d: false, e: false }));
    expect(r.level).toBe("LOW");
  });

  it("LOW with a null run", () => {
    const r = dataConfidence(null);
    expect(r.level).toBe("LOW");
    expect(r.feeds).toEqual([]);
    expect(r.line).toContain("No ingest run");
  });
});
