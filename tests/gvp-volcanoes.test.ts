/**
 * GVP volcano-hazard source tests. Covers the pure recency→level mapping, the
 * within-band score, and the full fetch path (spatial attribution, nearest-
 * province offshore fallback, and per-province worst-volcano selection) against
 * a mocked WFS response. No network.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchGvpVolcanoes,
  recencyLevel,
  volcanoScore,
  type GvpVolcanoResult,
} from "../ingest/sources/gvp-volcanoes";
import type { ProvincePolygon } from "../ingest/geo";

const YEAR = 2026;

describe("recencyLevel", () => {
  it("erupting this year → high (active)", () => {
    expect(recencyLevel(2026, YEAR)).toBe("high");
    expect(recencyLevel(2025, YEAR)).toBe("high"); // within 2-yr active window
  });
  it("within ~10 years → med (restless)", () => {
    expect(recencyLevel(2018, YEAR)).toBe("med");
  });
  it("within ~150 years → low (historically active)", () => {
    expect(recencyLevel(1950, YEAR)).toBe("low");
  });
  it("very old or unknown → low", () => {
    expect(recencyLevel(1200, YEAR)).toBe("low");
    expect(recencyLevel(null, YEAR)).toBe("low");
  });
});

describe("volcanoScore — graduated within band", () => {
  it("a fresher eruption sorts higher within the same level", () => {
    const thisYear = volcanoScore("high", 2026, YEAR);
    const lastYear = volcanoScore("high", 2025, YEAR);
    expect(thisYear).toBeGreaterThan(lastYear);
    // both stay inside the "high" quarter [0.5, 0.75]
    expect(thisYear).toBeGreaterThanOrEqual(0.5);
    expect(thisYear).toBeLessThanOrEqual(0.75);
    expect(lastYear).toBeGreaterThanOrEqual(0.5);
  });
  it("null last-eruption year sits at a small floor inside the band, not the edge", () => {
    const s = volcanoScore("med", null, YEAR);
    expect(s).toBeGreaterThan(0.25); // above the bare band floor (specificity floor)
    expect(s).toBeLessThan(0.5); // but still inside the med quarter [0.25,0.5]
  });

  it("even a dormant volcano scores above a generic green background (0.1) in its band", () => {
    // St-Andrew-Strait-like: low band, old eruption → must still beat GDACS green.
    const s = volcanoScore("low", 1957, YEAR);
    expect(s).toBeGreaterThan(0.1); // wins the same-level collapse tiebreaker
    expect(s).toBeLessThan(0.25); // stays inside the low quarter
  });
});

// Two unit-square provinces: LAND covers lon [0,1], plus a focus province ISLE
// whose representative point is far east so an offshore volcano attributes to it
// via nearest-province fallback.
const square = (minLon: number): [number, number][] => [
  [minLon, 0],
  [minLon + 1, 0],
  [minLon + 1, 1],
  [minLon, 1],
  [minLon, 0],
];
const POLYGONS: ProvincePolygon[] = [
  { code: "LAND", name: "Land", polygons: [[square(0)]] },
];
const REPS = [
  { code: "LAND", lon: 0.5, lat: 0.5 },
  { code: "ISLE", lon: 5.0, lat: 0.5 }, // no polygon → only reachable via nearest
];
const FOCUS = ["LAND", "ISLE"];

function mockWfs(features: { name: string; type: string; year: number | null; lon: number; lat: number }[]) {
  const body = {
    features: features.map((f) => ({
      geometry: { coordinates: [f.lon, f.lat] },
      properties: {
        Volcano_Name: f.name,
        Primary_Volcano_Type: f.type,
        Last_Eruption_Year: f.year,
        Country: "Papua New Guinea",
      },
    })),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => body })) as unknown as typeof fetch,
  );
}

describe("fetchGvpVolcanoes — spatial attribution + per-province worst", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("attributes a volcano inside a polygon to that province", async () => {
    mockWfs([{ name: "Inland", type: "Stratovolcano", year: 2026, lon: 0.5, lat: 0.5 }]);
    const r: GvpVolcanoResult = await fetchGvpVolcanoes(FOCUS, POLYGONS, REPS);
    const land = r.sector_rows.find((row) => row.province_code === "LAND");
    expect(land?.level).toBe("high");
    expect(land?.provenance).toBe("LIVE");
    expect(land?.data_source).toContain("Inland");
    expect(land?.data_source).toContain("2026");
  });

  it("attributes an offshore volcano to the nearest province (no polygon)", async () => {
    // [4.5,0.5] is outside LAND's polygon; nearest rep is ISLE (lon 5.0).
    mockWfs([{ name: "Titan Ridge", type: "Fissure vent", year: 1972, lon: 4.5, lat: 0.5 }]);
    const r = await fetchGvpVolcanoes(FOCUS, POLYGONS, REPS);
    const isle = r.sector_rows.find((row) => row.province_code === "ISLE");
    expect(isle).toBeDefined();
    expect(isle?.data_source).toContain("Titan Ridge");
    expect(isle?.data_source).toContain("offshore, nearest province");
    expect(r.volcanoes.find((v) => v.name === "Titan Ridge")?.attribution).toBe("nearest");
  });

  it("per province keeps the WORST volcano (active beats dormant)", async () => {
    mockWfs([
      { name: "Dormant", type: "Caldera", year: 1500, lon: 0.2, lat: 0.2 }, // low
      { name: "Active", type: "Stratovolcano", year: 2026, lon: 0.8, lat: 0.8 }, // high
    ]);
    const r = await fetchGvpVolcanoes(FOCUS, POLYGONS, REPS);
    const land = r.sector_rows.filter((row) => row.province_code === "LAND");
    expect(land).toHaveLength(1); // one row per province
    expect(land[0].level).toBe("high");
    expect(land[0].data_source).toContain("Active");
    expect(r.active_by_province["LAND"]).toContain("Active");
  });

  it("emits NO row for a province with no catalogued volcano (no invented risk)", async () => {
    mockWfs([{ name: "Inland", type: "Stratovolcano", year: 2026, lon: 0.5, lat: 0.5 }]);
    const r = await fetchGvpVolcanoes(FOCUS, POLYGONS, REPS);
    // ISLE has no volcano this run → no ISLE row at all.
    expect(r.sector_rows.some((row) => row.province_code === "ISLE")).toBe(false);
  });
});
