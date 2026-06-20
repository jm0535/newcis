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

import { riskMatrixSvg } from "../src/lib/sitrep-visuals";
import type { SectorRisk } from "../src/lib/types";

// PG08 = Enga, a real focus province p-code (codes are PG01–PG22, not PG-XX).
function sr(over: Partial<SectorRisk> = {}): SectorRisk {
  return {
    province_code: "PG08",
    sector: "Food Security",
    level: "critical",
    score: 0.9,
    trend: "up",
    provenance: "LIVE",
    as_of: "2026-06-20",
    ...over,
  };
}

describe("riskMatrixSvg", () => {
  it("renders an svg with the critical colour and a sector label", () => {
    const svg = riskMatrixSvg([sr()]);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("#334155"); // RISK_COLOUR.critical
    expect(svg).toContain("Food Security");
    expect(svg).toContain("National");
  });

  it("renders a note when there are no cells", () => {
    const svg = riskMatrixSvg([]);
    expect(svg).toContain("No sector cells");
  });
});

import { trendChartSvg } from "../src/lib/sitrep-visuals";
import type { Indicator, HistoricalReading } from "../src/lib/types";

function ind(key: string, label: string): Indicator {
  return {
    key,
    label,
    unit: "",
    source: "NOAA",
    update_frequency: "monthly",
    provenance: "LIVE",
    value: 1,
    observed_at: "2026-06-01",
    trend: "up",
  };
}

describe("trendChartSvg", () => {
  it("draws a mini chart for an indicator with >=2 readings and skips one with <2", () => {
    const indicators = [ind("ONI", "Oceanic Niño Index"), ind("SOI", "Southern Oscillation")];
    const history: HistoricalReading[] = [
      { key: "ONI", value: 0.1, observed_at: "2026-01-01" },
      { key: "ONI", value: 0.4, observed_at: "2026-02-01" },
      { key: "ONI", value: 0.8, observed_at: "2026-03-01" },
      { key: "SOI", value: -1, observed_at: "2026-03-01" }, // only 1 point → skipped
    ];
    const svg = trendChartSvg(history, indicators);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("Oceanic Niño Index");
    expect(svg).not.toContain("Southern Oscillation");
  });

  it("renders a note when no indicator has enough history", () => {
    const svg = trendChartSvg([], [ind("ONI", "Oceanic Niño Index")]);
    expect(svg).toContain("No trend history");
  });
});

import { provincialMapSvg } from "../src/lib/sitrep-visuals";
import type { ProvinceFC } from "../src/lib/types";

const fc: ProvinceFC = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { code: "PG08", name: "Enga", is_focus: true, population: 432000 },
      geometry: { type: "MultiPolygon", coordinates: [[[[143, -5], [144, -5], [144, -6], [143, -6], [143, -5]]]] },
    },
    {
      type: "Feature",
      properties: { code: "PG09", name: "Western Highlands", is_focus: true, population: 362000 },
      geometry: { type: "MultiPolygon", coordinates: [[[[144, -5], [145, -5], [145, -6], [144, -6], [144, -5]]]] },
    },
  ],
};

describe("provincialMapSvg", () => {
  it("draws one path per province, coloured by worst sector level", () => {
    const svg = provincialMapSvg(fc, [
      { province_code: "PG08", sector: "Food Security", level: "critical", score: 0.9, trend: "up", provenance: "LIVE", as_of: "2026-06-20" },
    ]);
    expect(svg.startsWith("<svg")).toBe(true);
    expect((svg.match(/<path /g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(svg).toContain("#334155"); // Enga critical fill
  });

  it("renders a note for an empty FeatureCollection", () => {
    const svg = provincialMapSvg({ type: "FeatureCollection", features: [] }, []);
    expect(svg).toContain("No province geometry");
  });
});
