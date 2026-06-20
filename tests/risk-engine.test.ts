/**
 * Risk engine fixture tests. The engine is the analytical core of NEWCIS — its outputs
 * must be reproducible and explainable. Each fixture pins a real historical scenario.
 */
import { describe, expect, it } from "vitest";
import {
  classifyIndicator,
  computeTrend,
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

  it("SEISMIC is one-sided (symmetric:false) — raw count escalates, no abs()", () => {
    expect(classifyIndicator(5, byKey("SEISMIC"))).toBe("GREEN"); // ≤10
    expect(classifyIndicator(18, byKey("SEISMIC"))).toBe("AMBER"); // >10
    expect(classifyIndicator(30, byKey("SEISMIC"))).toBe("RED"); // >25
    expect(classifyIndicator(50, byKey("SEISMIC"))).toBe("BLACK"); // >45
  });

  it("ONI stays symmetric — La Niña escalates via |value|, El Niño directly", () => {
    expect(classifyIndicator(-2.4, byKey("ONI"))).toBe("BLACK"); // strong La Niña
    expect(classifyIndicator(2.4, byKey("ONI"))).toBe("BLACK"); // strong El Niño
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

  it("threads asOf through to as_of — engine stays pure (no wall-clock)", () => {
    const r = scoreSector("PG08", "Food Security", {
      indicators: [],
      thresholds: TH,
      asOf: "2026-03-15T00:00:00.000Z",
    });
    expect(r.as_of).toBe("2026-03-15T00:00:00.000Z");
  });
});

// The score is a GRADUATED, within-band sort tiebreaker — never a level. These
// pin the two invariants: (1) two cells at the same level get DIFFERENT scores
// ordered by how deep into the band they sit; (2) the score's quarter ALWAYS
// equals its level's quarter, so sorting by score can never cross a level.
describe("scoreSector — graduated score (sort tiebreaker only)", () => {
  // RISK_ORDER quarters: low [0,0.25) med [0.25,0.5) high [0.5,0.75) critical [0.75,1].
  const QUARTER: Record<string, [number, number]> = {
    low: [0, 0.25],
    med: [0.25, 0.5],
    high: [0.5, 0.75],
    critical: [0.75, 1.0],
  };
  const inBand = (level: string, score: number) => {
    const [lo, hi] = QUARTER[level];
    return score >= lo && score <= hi;
  };

  it("two same-level cells get distinguishable scores ordered by band depth", () => {
    // RAINFALL_ANOM is inverted: red band is (amber_max, red_max] = (-40,-60]. A
    // deeper deficit sits lower in the band → higher score, but BOTH stay "high".
    const shallow = scoreSector("PG08", "Water Security", {
      indicators: [indicator("RAINFALL_ANOM", -45)],
      thresholds: TH,
    });
    const deep = scoreSector("PG09", "Water Security", {
      indicators: [indicator("RAINFALL_ANOM", -58)],
      thresholds: TH,
    });
    expect(shallow.level).toBe("high");
    expect(deep.level).toBe("high");
    expect(deep.score).toBeGreaterThan(shallow.score); // deeper deficit sorts first
    expect(inBand("high", shallow.score)).toBe(true);
    expect(inBand("high", deep.score)).toBe(true);
  });

  it("score's quarter always equals the level's quarter, across every band", () => {
    const cases: { value: number; level: string }[] = [
      { value: -10, level: "low" }, // GREEN-equivalent → low
      { value: -30, level: "med" }, // AMBER band
      { value: -50, level: "high" }, // RED band
      { value: -70, level: "critical" }, // BLACK band
    ];
    for (const c of cases) {
      const r = scoreSector("PG08", "Water Security", {
        indicators: [indicator("RAINFALL_ANOM", c.value)],
        thresholds: TH,
      });
      expect(r.level).toBe(c.level);
      expect(inBand(c.level, r.score)).toBe(true);
    }
  });

  it("a higher band always outsorts a lower band regardless of within-band depth", () => {
    const medDeep = scoreSector("PG08", "Water Security", {
      indicators: [indicator("RAINFALL_ANOM", -39)], // deep in AMBER (just before RED)
      thresholds: TH,
    });
    const highShallow = scoreSector("PG09", "Water Security", {
      indicators: [indicator("RAINFALL_ANOM", -41)], // just into RED
      thresholds: TH,
    });
    expect(medDeep.level).toBe("med");
    expect(highShallow.level).toBe("high");
    // Even a near-maxed med cell must sort below a barely-RED cell.
    expect(highShallow.score).toBeGreaterThan(medDeep.score);
  });

  it("max-merge with a differently-scaled upstream row stays pinned to the level", () => {
    // An upstream row carries level "med" but a score (0.4) at the TOP of its
    // quarter. After pinning, the engine cell stays in the med quarter — the
    // upstream score scale can't bleed into the high quarter.
    const r = scoreSector("PG07", "Water Security", {
      indicators: [indicator("RAINFALL_ANOM", -10)], // would be low alone
      thresholds: TH,
      provinceSectorRow: {
        province_code: "PG07",
        sector: "Water Security",
        level: "med",
        score: 0.48, // top of the med quarter
        trend: "flat",
        provenance: "LIVE",
        as_of: "2026-01-01",
      },
    });
    expect(r.level).toBe("med");
    expect(inBand("med", r.score)).toBe(true);
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

  it("the projected-ONI forecast does NOT raise the national alert", () => {
    // ONI is neutral now, but the NMME projected ONI for next season leans hot
    // and would classify BLACK on its own band. It is forward-looking context —
    // shown on the /forecast gauge — and must never escalate TODAY's live alert.
    const r = rollUpNational(
      [
        indicator("ONI", 0.1), // neutral now
        indicator("PROJECTED_ONI", 2.0), // hot forecast — would be BLACK on its band
      ],
      TH,
      [],
      FOCUS,
    );
    expect(r.alert_level).toBe("GREEN");
  });

  it("seismic tempo does NOT raise the national ENSO alert", () => {
    // Earthquakes are a non-ENSO geophysical hazard. A routine seismic month
    // (AMBER on its own band) must not pin the national ENSO traffic-light while
    // the ocean reads neutral — it escalates the per-province Disaster cell only.
    const r = rollUpNational(
      [
        indicator("ONI", 0.1), // neutral ENSO
        indicator("SEISMIC", 20), // AMBER on its band (10–25)
      ],
      TH,
      [],
      FOCUS,
    );
    expect(r.alert_level).toBe("GREEN");
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

  // ENSO phase must agree with the gauge colour: both come from the ONI
  // threshold band, so a value in the RED band reads as "alert", AMBER as
  // "watch". This pins that the phase reads the file, not a hardcoded edge.
  it("ENSO phase agrees with the indicator alert band (watch vs alert)", () => {
    const oniBand = byKey("ONI");
    // Mid-AMBER band → watch (and classifyIndicator agrees it is AMBER).
    const watchVal = (oniBand.green_max + oniBand.amber_max) / 2; // 0.75
    expect(classifyIndicator(watchVal, oniBand)).toBe("AMBER");
    expect(rollUpNational([indicator("ONI", watchVal)], TH, [], FOCUS).enso_phase).toBe(
      "el_nino_watch",
    );
    // Inside the RED band → alert (classifyIndicator agrees it is RED).
    const alertVal = (oniBand.amber_max + oniBand.red_max) / 2; // 1.25
    expect(classifyIndicator(alertVal, oniBand)).toBe("RED");
    expect(rollUpNational([indicator("ONI", alertVal)], TH, [], FOCUS).enso_phase).toBe(
      "el_nino_alert",
    );
  });

  it("affected_population_est sums only high/critical provinces from real populations", () => {
    const sectors: SectorRisk[] = [
      { province_code: "PG08", sector: "Water Security", level: "critical", score: 1, trend: "flat", provenance: "LIVE", as_of: "2026-01-01" },
      { province_code: "PG09", sector: "Water Security", level: "high", score: 0.7, trend: "flat", provenance: "LIVE", as_of: "2026-01-01" },
      { province_code: "PG07", sector: "Water Security", level: "med", score: 0.4, trend: "flat", provenance: "LIVE", as_of: "2026-01-01" },
    ];
    const pop = { PG08: 432000, PG09: 362000, PG07: 510000 };
    const r = rollUpNational([indicator("ONI", 0.1)], TH, sectors, FOCUS, "Next 3 months", pop);
    // PG08 + PG09 are high/critical; PG07 (med) excluded.
    expect(r.affected_population_est).toBe(432000 + 362000);
  });

  it("affected_population_est is 0 when no population map is supplied (UI shows —)", () => {
    const sectors: SectorRisk[] = [
      { province_code: "PG08", sector: "Water Security", level: "critical", score: 1, trend: "flat", provenance: "LIVE", as_of: "2026-01-01" },
    ];
    const r = rollUpNational([indicator("ONI", 0.1)], TH, sectors, FOCUS);
    expect(r.affected_population_est).toBe(0);
  });

  it("threads asOf through to updated_at — deterministic, no wall-clock", () => {
    const r = rollUpNational(
      [indicator("ONI", 0.1)],
      TH,
      [],
      FOCUS,
      "Next 3 months",
      undefined,
      "2026-03-15T00:00:00.000Z",
    );
    expect(r.updated_at).toBe("2026-03-15T00:00:00.000Z");
  });
});

describe("computeTrend", () => {
  const hist = [
    { key: "ONI", value: 0.8, observed_at: "2025-12-01" },
    { key: "ONI", value: 0.6, observed_at: "2025-11-01" },
  ];

  it("rising value → up", () => {
    expect(computeTrend("ONI", 1.4, hist)).toBe("up");
  });

  it("falling value → down", () => {
    expect(computeTrend("ONI", 0.2, hist)).toBe("down");
  });

  it("tiny delta under threshold → flat", () => {
    expect(computeTrend("ONI", 0.82, hist)).toBe("flat");
  });

  it("no prior reading → flat", () => {
    expect(computeTrend("NEW_METRIC", 1.0, hist)).toBe("flat");
  });

  it("skips the current reading's own date so a monthly re-emit still trends", () => {
    // A monthly indicator re-emits the same observed_at every cycle; that row is
    // already in history. Without the skip, the latest row (0.8 @ 2025-12-01) is
    // compared to itself → flat. Passing the current observed_at makes it compare
    // against the genuinely earlier reading (0.6 @ 2025-11-01) → up.
    expect(computeTrend("ONI", 0.8, hist, 0.05, 0.05, "2025-12-01")).toBe("up");
  });
});
