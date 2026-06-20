// tests/sitrep-visuals.test.ts
import { describe, it, expect } from "vitest";
import { kpiBandSvg } from "../src/lib/sitrep-visuals";
import type { NationalStatus } from "../src/lib/types";

function ns(over: Partial<NationalStatus> = {}): NationalStatus {
  return {
    enso_phase: "neutral",
    alert_level: "AMBER",
    national_risk_rating: "med",
    affected_population_est: 1_795_581,
    high_risk_province_count: 3,
    forecast_period: "Next 3 months",
    updated_at: "2026-06-20T00:00:00.000Z",
    ...over,
  };
}

describe("kpiBandSvg", () => {
  it("returns an svg containing the alert level and a grouped population", () => {
    const svg = kpiBandSvg(ns());
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("AMBER");
    expect(svg).toContain("1,795,581");
    expect(svg).toContain("Next 3 months");
  });

  it("renders a single fallback cell when national is null", () => {
    const svg = kpiBandSvg(null);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("No national status");
  });
});
