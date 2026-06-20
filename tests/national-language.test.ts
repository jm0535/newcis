import { describe, it, expect } from "vitest";
import {
  PHASE_PLAIN,
  ALERT_ACTION,
  bottomLineSentence,
} from "../src/lib/national-language";
import { FOCUS_COUNT } from "../src/lib/focus-provinces";
import type { NationalStatus } from "../src/lib/types";

function ns(over: Partial<NationalStatus> = {}): NationalStatus {
  return {
    enso_phase: "neutral",
    alert_level: "AMBER",
    national_risk_rating: "med",
    affected_population_est: 1_000_000,
    high_risk_province_count: 0,
    forecast_period: "Next 3 months",
    updated_at: "2026-06-20T00:00:00.000Z",
    ...over,
  };
}

describe("national-language", () => {
  it("phase plain text matches the dashboard wording", () => {
    expect(PHASE_PLAIN.neutral).toBe(
      "The Pacific is in a neutral state (no El Niño or La Niña)",
    );
    expect(PHASE_PLAIN.el_nino_alert).toBe(
      "An El Niño is underway (highland drought & frost likely)",
    );
  });

  it("alert action matches the dashboard wording", () => {
    expect(ALERT_ACTION.AMBER).toBe("Brief sector leads and verify cluster readiness.");
    expect(ALERT_ACTION.BLACK).toBe("Activate the National Emergency Operations Centre now.");
  });

  it("bottom line ends with a period when no provinces are stressed", () => {
    const s = bottomLineSentence(ns({ enso_phase: "neutral", alert_level: "AMBER", national_risk_rating: "med", high_risk_province_count: 0 }));
    expect(s).toBe(
      "The Pacific is in a neutral state (no El Niño or La Niña), but the national alert is AMBER and overall risk is MED.",
    );
  });

  it("bottom line appends the stressed-province clause", () => {
    const s = bottomLineSentence(ns({ enso_phase: "el_nino_alert", alert_level: "RED", national_risk_rating: "high", high_risk_province_count: 3 }));
    expect(s).toBe(
      `An El Niño is underway (highland drought & frost likely), but the national alert is RED and overall risk is HIGH: 3 of the ${FOCUS_COUNT} focus provinces are stressed across multiple sectors.`,
    );
  });
});
