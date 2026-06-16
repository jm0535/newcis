import { describe, expect, it } from "vitest";
import { SECTOR_CASCADES } from "../src/lib/cascades";
import type { Sector } from "../src/lib/types";

const SECTORS: Sector[] = [
  "Food Security", "Water Security", "Public Health", "Economic Stability",
  "Infrastructure", "Energy Security", "Social Stability", "Disaster & Hazard",
];

describe("SECTOR_CASCADES", () => {
  it("has at least 5 cascade edges", () => {
    expect(SECTOR_CASCADES.length).toBeGreaterThanOrEqual(5);
  });

  it("uses only valid Sector endpoints", () => {
    for (const c of SECTOR_CASCADES) {
      expect(SECTORS).toContain(c.from);
      expect(SECTORS).toContain(c.to);
    }
  });

  it("has no self-loops", () => {
    for (const c of SECTOR_CASCADES) expect(c.from).not.toBe(c.to);
  });

  it("has no duplicate edges", () => {
    const seen = new Set(SECTOR_CASCADES.map((c) => `${c.from}->${c.to}`));
    expect(seen.size).toBe(SECTOR_CASCADES.length);
  });

  it("every edge carries a non-empty rationale and a valid strength", () => {
    for (const c of SECTOR_CASCADES) {
      expect(c.rationale.trim().length).toBeGreaterThan(0);
      expect(["weak", "moderate", "strong"]).toContain(c.strength);
    }
  });
});
