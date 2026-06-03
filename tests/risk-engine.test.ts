/**
 * Risk engine fixture tests. The engine is the analytical core of NEWCIS — its outputs
 * must be reproducible and explainable. Each fixture pins a real historical scenario.
 */
import { describe, expect, it } from "vitest";
import {
  classifyIndicator,
  rollUpNational,
  scoreSector,
} from "../src/lib/risk-engine";
import thresholds from "../data/risk_thresholds.json";
import type { Indicator, RiskThreshold, SectorRisk } from "../src/lib/types";

const TH = thresholds as RiskThreshold[];
const byKey = (k: string) => TH.find((t) => t.metric === k)!;

const indicator = (key: string, value: number | null): Indicator => ({
  key,
  label: key,
  unit: "",
  source: "test",
  update_frequency: "monthly",
  provenance: "LIVE",
  value,
  observed_at: "2026-01-01",
  trend: "flat",
});

const FOCUS = ["PG08", "PG09", "PG07", "PG02"];

describe("classifyIndicator", () => {
  it("ONI neutral → GREEN", () => {
    expect(classifyIndicator(0.11, byKey("ONI"))).toBe("GREEN");
  });

  it("ONI weak El Niño (0.7) → AMBER", () => {
    expect(classifyIndicator(0.7, byKey("ONI"))).toBe("AMBER");
  });

  it("ONI moderate El Niño (1.2) → RED", () => {
    expect(classifyIndicator(1.2, byKey("ONI"))).toBe("RED");
  });

  it("1997-98 strong El Niño (ONI 2.4) → BLACK", () => {
    expect(classifyIndicator(2.4, byKey("ONI"))).toBe("BLACK");
  });

  it("La Niña symmetry — ONI -1.5 → RED via absolute value", () => {
    expect(classifyIndicator(-1.5, byKey("ONI"))).toBe("RED");
  });

  it("rainfall anomaly -50% (severe deficit) → RED (inverted band)", () => {
    expect(classifyIndicator(-50, byKey("RAINFALL_ANOM"))).toBe("RED");
  });

  it("rainfall anomaly -10% near-normal → GREEN", () => {
    expect(classifyIndicator(-10, byKey("RAINFALL_ANOM"))).toBe("GREEN");
  });

  it("null value → GREEN (degrades gracefully, never throws)", () => {
    expect(classifyIndicator(null, byKey("ONI"))).toBe("GREEN");
  });

  it("missing threshold → GREEN", () => {
    expect(classifyIndicator(5, undefined)).toBe("GREEN");
  });
});

describe("scoreSector", () => {
  it("Water Security follows rainfall driver in a drought", () => {
    const r = scoreSector("PG07", "Water Security", {
      indicators: [indicator("RAINFALL_ANOM", -45)],
      thresholds: TH,
    });
    expect(r.level).toBe("high"); // RED → high
    expect(r.province_code).toBe("PG07");
  });

  it("province-specific row escalates beyond the national signal", () => {
    const localRow: SectorRisk = {
      province_code: "PG07",
      sector: "Water Security",
      level: "critical",
      score: 0.95,
      trend: "down",
      provenance: "LIVE",
      as_of: "2026-01-01",
      data_source: "HDX rainfall",
    };
    const r = scoreSector("PG07", "Water Security", {
      indicators: [indicator("RAINFALL_ANOM", -10)], // would be "low" alone
      thresholds: TH,
      provinceSectorRow: localRow,
    });
    expect(r.level).toBe("critical");
    expect(r.provenance).toBe("LIVE");
    expect(r.data_source).toBe("HDX rainfall");
  });

  it("Economic Stability climbs with ONI", () => {
    const r = scoreSector("PG08", "Economic Stability", {
      indicators: [indicator("ONI", 1.6)],
      thresholds: TH,
    });
    expect(r.level).toBe("critical"); // BLACK → critical
  });

  it("returns low when no drivers present", () => {
    const r = scoreSector("PG08", "Food Security", { indicators: [], thresholds: TH });
    expect(r.level).toBe("low");
    expect(r.provenance).toBe("DEMO");
  });
});

describe("rollUpNational", () => {
  it("1997-98 fixture: strong El Niño + severe drought → BLACK + el_nino_alert", () => {
    const indicators: Indicator[] = [
      indicator("ONI", 2.4),
      indicator("RAINFALL_ANOM", -65),
    ];
    const sectors: SectorRisk[] = FOCUS.map((p) => ({
      province_code: p,
      sector: "Water Security",
      level: "critical",
      score: 1,
      trend: "down",
      provenance: "LIVE",
      as_of: "1997-10-01",
    }));
    const r = rollUpNational(indicators, TH, sectors, FOCUS);
    expect(r.alert_level).toBe("BLACK");
    expect(r.enso_phase).toBe("el_nino_alert");
    expect(r.national_risk_rating).toBe("high");
    expect(r.high_risk_province_count).toBe(4);
  });

  it("neutral baseline → GREEN + neutral phase + low rating", () => {
    const r = rollUpNational([indicator("ONI", 0.1)], TH, [], FOCUS);
    expect(r.alert_level).toBe("GREEN");
    expect(r.enso_phase).toBe("neutral");
    expect(r.national_risk_rating).toBe("low");
    expect(r.high_risk_province_count).toBe(0);
  });

  it("la_nina_alert phase when ONI < -1.0", () => {
    const r = rollUpNational([indicator("ONI", -1.3)], TH, [], FOCUS);
    expect(r.enso_phase).toBe("la_nina_alert");
  });

  it("one focus province in high risk → med rating", () => {
    const sectors: SectorRisk[] = [
      {
        province_code: "PG08",
        sector: "Water Security",
        level: "high",
        score: 0.7,
        trend: "flat",
        provenance: "LIVE",
        as_of: "2026-01-01",
      },
    ];
    const r = rollUpNational([indicator("ONI", 0.1)], TH, sectors, FOCUS);
    expect(r.national_risk_rating).toBe("med");
    expect(r.high_risk_province_count).toBe(1);
  });
});
