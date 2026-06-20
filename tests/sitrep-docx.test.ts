// tests/sitrep-docx.test.ts
import { describe, it, expect } from "vitest";
import { buildSitrepDocx } from "../src/lib/sitrep-docx";
import { buildSitrepModel } from "../src/lib/sitrep";

describe("buildSitrepDocx", () => {
  it("resolves to a non-empty .docx buffer with visuals embedded", async () => {
    const model = buildSitrepModel({
      national: {
        enso_phase: "el_nino_alert",
        alert_level: "RED",
        national_risk_rating: "high",
        affected_population_est: 1_795_581,
        high_risk_province_count: 3,
        forecast_period: "Next 3 months",
        updated_at: "2026-06-20T00:00:00.000Z",
      },
      indicators: [
        { key: "ONI", label: "Oceanic Niño Index", unit: "", source: "NOAA", update_frequency: "monthly", provenance: "LIVE", value: 0.9, observed_at: "2026-02-01", trend: "up" },
      ],
      sectorRisk: [
        { province_code: "PG08", sector: "Food Security", level: "critical", score: 0.9, trend: "up", provenance: "LIVE", as_of: "2026-06-20" },
      ],
      lastRun: { started_at: "", finished_at: "", status: "partial", sources_ok: { noaa_oni: false, hdx_food: true }, notes: "" },
    });

    const buffer = await buildSitrepDocx(model, {
      national: {
        enso_phase: "el_nino_alert", alert_level: "RED", national_risk_rating: "high",
        affected_population_est: 1_795_581, high_risk_province_count: 3,
        forecast_period: "Next 3 months", updated_at: "2026-06-20T00:00:00.000Z",
      },
      indicators: [
        { key: "ONI", label: "Oceanic Niño Index", unit: "", source: "NOAA", update_frequency: "monthly", provenance: "LIVE", value: 0.9, observed_at: "2026-02-01", trend: "up" },
      ],
      sectorRisk: [
        { province_code: "PG08", sector: "Food Security", level: "critical", score: 0.9, trend: "up", provenance: "LIVE", as_of: "2026-06-20" },
      ],
      history: [
        { key: "ONI", value: 0.2, observed_at: "2026-01-01" },
        { key: "ONI", value: 0.9, observed_at: "2026-02-01" },
      ],
      geojson: { type: "FeatureCollection", features: [] },
    });

    expect(buffer.length).toBeGreaterThan(2000);
    // .docx is a zip — starts with PK.
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });
});
