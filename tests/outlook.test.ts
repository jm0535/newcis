/**
 * Outlook fixture tests. The outlook is a precursor-ALIGNMENT read over the
 * relayed NMME forecast — not a model. Each case pins the agreement / confidence
 * logic so the /forecast page narrative stays reproducible and explainable.
 */
import { describe, expect, it } from "vitest";
import { deriveOutlook } from "../src/lib/outlook";
import thresholds from "../data/risk_thresholds.json";
import type { Indicator, RiskThreshold } from "../src/lib/types";

const TH = thresholds as RiskThreshold[];

const ind = (key: string, value: number | null): Indicator => ({
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

describe("deriveOutlook", () => {
  it("model + all three precursors agree El Niño → high confidence", () => {
    const o = deriveOutlook(
      [
        ind("PROJECTED_ONI", 1.05),
        ind("ONI", 0.7), // ≥ 0.5 → el_nino
        ind("SOI", -0.9), // ≤ -0.7 → el_nino
        ind("TRADE_WIND_ANOM", -0.8), // ≤ -0.5 → el_nino
      ],
      TH,
      "MJJ 2026",
    );
    expect(o.projectedLean).toBe("el_nino");
    expect(o.precursorsWithData).toBe(3);
    expect(o.agreement).toBe(3);
    expect(o.confidence).toBe("high");
    expect(o.summary).toContain("El Niño");
    expect(o.summary).toContain("MJJ 2026");
  });

  it("model leans El Niño but a precursor opposes → low confidence", () => {
    const o = deriveOutlook(
      [
        ind("PROJECTED_ONI", 0.9), // el_nino
        ind("ONI", 0.1), // neutral
        ind("SOI", 1.2), // positive → la_nina (opposes)
        ind("TRADE_WIND_ANOM", -0.8), // el_nino (agrees)
      ],
      TH,
      "MJJ 2026",
    );
    expect(o.projectedLean).toBe("el_nino");
    expect(o.agreement).toBe(1);
    expect(o.confidence).toBe("low"); // an opposing precursor caps it
  });

  it("model leans El Niño, one precursor agrees, none oppose → moderate", () => {
    const o = deriveOutlook(
      [
        ind("PROJECTED_ONI", 0.8),
        ind("ONI", 0.1), // neutral
        ind("SOI", -0.3), // neutral (above -0.7 edge)
        ind("TRADE_WIND_ANOM", -0.9), // el_nino (agrees)
      ],
      TH,
      "MJJ 2026",
    );
    expect(o.agreement).toBe(1);
    expect(o.precursorsWithData).toBe(1);
    expect(o.confidence).toBe("moderate");
  });

  it("missing forecast → neutral lean, indeterminate summary", () => {
    const o = deriveOutlook([ind("ONI", 0.1)], TH, null);
    expect(o.projectedLean).toBe("neutral");
    expect(o.projectedOni).toBeNull();
    expect(o.summary).toContain("indeterminate");
  });

  it("neutral model + quiet precursors → moderate (coherent neutral)", () => {
    const o = deriveOutlook(
      [
        ind("PROJECTED_ONI", 0.2), // neutral
        ind("ONI", 0.1),
        ind("SOI", -0.2),
        ind("TRADE_WIND_ANOM", -0.1),
      ],
      TH,
      "MJJ 2026",
    );
    expect(o.projectedLean).toBe("neutral");
    expect(o.confidence).toBe("moderate");
  });

  it("neutral model + precursors split both phases → low (unsettled)", () => {
    const o = deriveOutlook(
      [
        ind("PROJECTED_ONI", 0.2), // neutral
        ind("SOI", -0.9), // el_nino
        ind("TRADE_WIND_ANOM", 0.8), // la_nina
      ],
      TH,
      "MJJ 2026",
    );
    expect(o.projectedLean).toBe("neutral");
    expect(o.confidence).toBe("low");
  });

  it("La Niña forecast with agreeing precursors", () => {
    const o = deriveOutlook(
      [
        ind("PROJECTED_ONI", -1.1), // la_nina
        ind("ONI", -0.7), // la_nina
        ind("SOI", 1.0), // la_nina
      ],
      TH,
      "DJF 2027",
    );
    expect(o.projectedLean).toBe("la_nina");
    expect(o.agreement).toBe(2);
    expect(o.confidence).toBe("high");
    expect(o.summary).toContain("La Niña");
  });
});
