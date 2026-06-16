/**
 * Topology builder tests. buildTopology is a PURE projection of the risk engine's
 * own graph (indicators → sectors → centre) into {nodes, edges} for the radial
 * "Risk Topology" view. It invents no risk — it re-expresses scoreSector /
 * classifyIndicator output as a graph, so the picture can never disagree with the
 * dashboard. Same purity contract as the engine: missing data degrades, never throws.
 */
import { describe, expect, it } from "vitest";
import { buildTopology } from "../src/lib/topology";
import thresholds from "../data/risk_thresholds.json";
import type { Indicator, RiskThreshold, SectorRisk } from "../src/lib/types";

const TH = thresholds as RiskThreshold[];

const indicator = (key: string, value: number | null): Indicator => ({
  key,
  label: key,
  unit: "x",
  source: "test",
  update_frequency: "monthly",
  provenance: "LIVE",
  value,
  observed_at: "2026-01-01",
  trend: "flat",
});

const sectorRow = (
  province_code: string,
  sector: SectorRisk["sector"],
  level: SectorRisk["level"],
): SectorRisk => ({
  province_code,
  sector,
  level,
  score: 0.5,
  trend: "flat",
  provenance: "LIVE",
  as_of: "2026-01-01T00:00:00Z",
});

const FOCUS = ["PG08", "PG09"];

describe("buildTopology — national centre", () => {
  const indicators = [
    indicator("ONI", 1.2), // RED
    indicator("RAINFALL_ANOM", -50), // RED (inverted)
    indicator("NDVI", 0.1),
  ];
  const sectorRisks = [
    sectorRow("PG08", "Food Security", "high"),
    sectorRow("PG09", "Food Security", "med"),
    sectorRow("PG08", "Economic Stability", "critical"),
  ];

  const g = buildTopology({
    indicators,
    sectorRisks,
    thresholds: TH,
    focusCodes: FOCUS,
    center: { kind: "national" },
  });

  it("has exactly one centre node at ring 0", () => {
    const centres = g.nodes.filter((n) => n.kind === "center");
    expect(centres).toHaveLength(1);
    expect(centres[0].ring).toBe(0);
  });

  it("emits an indicator node per supplied indicator at ring 1", () => {
    const inds = g.nodes.filter((n) => n.kind === "indicator");
    expect(inds.map((n) => n.id).sort()).toEqual(["NDVI", "ONI", "RAINFALL_ANOM"]);
    expect(inds.every((n) => n.ring === 1)).toBe(true);
  });

  it("classifies an indicator node by the engine's own bands (ONI 1.2 → RED)", () => {
    const oni = g.nodes.find((n) => n.id === "ONI")!;
    expect(oni.level).toBe("RED");
  });

  it("rolls a sector node up to its WORST level across focus provinces", () => {
    // Food Security: PG08 high + PG09 med → worst = high
    const food = g.nodes.find((n) => n.kind === "sector" && n.id === "Food Security")!;
    expect(food.ring).toBe(2);
    expect(food.level).toBe("high");
  });

  it("links each driver indicator to the sectors it drives", () => {
    // SECTOR_DRIVERS: Food Security ← RAINFALL_ANOM, NDVI, SOIL_MOISTURE
    const edge = g.edges.find(
      (e) => e.from === "RAINFALL_ANOM" && e.to === "Food Security",
    );
    expect(edge).toBeTruthy();
  });

  it("links every sector node to the centre", () => {
    const sectorIds = g.nodes.filter((n) => n.kind === "sector").map((n) => n.id);
    for (const sid of sectorIds) {
      expect(g.edges.some((e) => e.from === sid && e.to === "__center__")).toBe(true);
    }
  });

  it("does not emit a driver edge for an indicator that was not supplied", () => {
    // SOIL_MOISTURE absent from indicators → no edge from it
    expect(g.edges.some((e) => e.from === "SOIL_MOISTURE")).toBe(false);
  });

  it("tags edges by wiring kind (driver / rollup)", () => {
    const driver = g.edges.find((e) => e.from === "RAINFALL_ANOM" && e.to === "Food Security");
    expect(driver?.kind).toBe("driver");
    const rollup = g.edges.find((e) => e.to === "__center__");
    expect(rollup?.kind).toBe("rollup");
  });

  it("draws SEISMIC → Disaster & Hazard as an ATTRIBUTED edge when SEISMIC is supplied", () => {
    // SEISMIC is NOT in SECTOR_DRIVERS (per-province spatial attribution), but the
    // graph still shows the link so the node is not an orphan — dashed/attributed.
    const withSeismic = buildTopology({
      indicators: [...indicators, indicator("SEISMIC", 30)],
      sectorRisks,
      thresholds: TH,
      focusCodes: FOCUS,
      center: { kind: "national" },
    });
    const e = withSeismic.edges.find(
      (x) => x.from === "SEISMIC" && x.to === "Disaster & Hazard",
    );
    expect(e?.kind).toBe("attributed");
  });

  it("does not emit a SEISMIC edge when SEISMIC is absent", () => {
    expect(g.edges.some((e) => e.from === "SEISMIC")).toBe(false);
  });

  it("centre provenance tracks the worst-contributing indicator, never faking LIVE", () => {
    // Credibility rule: never present DEMO as LIVE. If the indicator that drives
    // the centre alert is DEMO, the centre badge must read DEMO.
    const demoInd: Indicator = { ...indicator("TEMP_ANOM", 99), provenance: "DEMO" };
    const g3 = buildTopology({
      indicators: [indicator("ONI", 0.2), demoInd], // TEMP_ANOM=99 → worst, DEMO
      sectorRisks: [],
      thresholds: TH,
      focusCodes: FOCUS,
      center: { kind: "national" },
    });
    const centre = g3.nodes.find((n) => n.kind === "center")!;
    expect(centre.provenance).toBe("DEMO");
  });

  it("excludes forward-looking PROJECTED_ONI from the centre alert level", () => {
    // PROJECTED_ONI is a FORECAST (NMME projected ONI). rollUpNational excludes it
    // from today's alert — a forecast leaning El Niño is not a present emergency.
    // The topology centre must agree: PROJECTED_ONI=1.85 (→BLACK on its own) must
    // NOT drive the centre past the worst LIVE indicator.
    const g2 = buildTopology({
      indicators: [
        indicator("ONI", 0.4), // GREEN
        indicator("SOI", -0.9), // AMBER
        indicator("PROJECTED_ONI", 1.85), // BLACK on its own — but forecast-only
      ],
      sectorRisks: [],
      thresholds: TH,
      focusCodes: FOCUS,
      center: { kind: "national" },
    });
    const centre = g2.nodes.find((n) => n.kind === "center")!;
    // worst LIVE indicator is SOI (AMBER); PROJECTED_ONI must not push it to BLACK
    expect(centre.level).toBe("AMBER");
    // but PROJECTED_ONI is still drawn as its own indicator node
    expect(g2.nodes.some((n) => n.id === "PROJECTED_ONI" && n.kind === "indicator")).toBe(true);
  });
});

describe("buildTopology — province centre", () => {
  const indicators = [indicator("ONI", 0.2), indicator("RAINFALL_ANOM", -50)];
  const sectorRisks = [
    sectorRow("PG08", "Food Security", "critical"),
    sectorRow("PG09", "Food Security", "low"),
  ];

  it("scopes sector levels to the chosen province only", () => {
    const g = buildTopology({
      indicators,
      sectorRisks,
      thresholds: TH,
      focusCodes: FOCUS,
      center: { kind: "province", code: "PG09" },
    });
    const food = g.nodes.find((n) => n.kind === "sector" && n.id === "Food Security")!;
    // PG09 Food Security is low (NOT PG08's critical)
    expect(food.level).toBe("low");
    const centre = g.nodes.find((n) => n.kind === "center")!;
    expect(centre.id).toBe("__center__");
    expect(centre.label).toContain("PG09");
  });
});

describe("buildTopology — degrades, never throws", () => {
  it("returns a centre + indicator nodes even with empty sector data", () => {
    const g = buildTopology({
      indicators: [indicator("ONI", null)],
      sectorRisks: [],
      thresholds: TH,
      focusCodes: FOCUS,
      center: { kind: "national" },
    });
    expect(g.nodes.some((n) => n.kind === "center")).toBe(true);
    expect(g.nodes.find((n) => n.id === "ONI")!.level).toBe("GREEN"); // null → GREEN
  });

  it("handles entirely empty input without throwing", () => {
    expect(() =>
      buildTopology({
        indicators: [],
        sectorRisks: [],
        thresholds: [],
        focusCodes: [],
        center: { kind: "national" },
      }),
    ).not.toThrow();
  });
});
