/**
 * SITREP model tests. buildSitrepModel is the pure data→report shaper; these pin
 * the parts an executive reads off the printed page: alert tier → action set,
 * worst-first provincial ranking, summary line, and XSS-safe HTML rendering of
 * the free-text analyst note.
 */
import { describe, expect, it } from "vitest";
import { buildSitrepModel, renderSitrepHtml, type SitrepInputs } from "../src/lib/sitrep";
import type { NationalStatus, SectorRisk } from "../src/lib/types";

const national = (over: Partial<NationalStatus> = {}): NationalStatus => ({
  enso_phase: "neutral",
  alert_level: "GREEN",
  national_risk_rating: "low",
  affected_population_est: 0,
  high_risk_province_count: 0,
  forecast_period: "Next 3 months",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

const sector = (over: Partial<SectorRisk> & Pick<SectorRisk, "province_code" | "sector" | "level">): SectorRisk => ({
  score: 0.5,
  trend: "flat",
  provenance: "LIVE",
  as_of: "2026-01-01",
  ...over,
});

const inputs = (over: Partial<SitrepInputs> = {}): SitrepInputs => ({
  national: national(),
  indicators: [],
  sectorRisk: [],
  lastRun: null,
  ...over,
});

describe("buildSitrepModel", () => {
  it("BLACK alert yields the emergency action set", () => {
    const m = buildSitrepModel(inputs({ national: national({ alert_level: "BLACK" }) }));
    expect(m.alert).toBe("BLACK");
    expect(m.actions.some((a) => /NEOC/.test(a))).toBe(true);
  });

  it("GREEN alert yields routine-monitoring actions only", () => {
    const m = buildSitrepModel(inputs());
    expect(m.actions.some((a) => /Routine monitoring/.test(a))).toBe(true);
    expect(m.actions.some((a) => /NEOC/.test(a))).toBe(false);
  });

  it("null national status degrades — neutral header, no actions", () => {
    const m = buildSitrepModel(inputs({ national: null }));
    expect(m.alert).toBe("GREEN");
    expect(m.enso).toBe("ENSO Neutral");
    expect(m.actions).toEqual([]);
  });

  it("provinces rank worst-first; provincesAtRisk counts high/critical", () => {
    const m = buildSitrepModel(
      inputs({
        sectorRisk: [
          sector({ province_code: "PG08", sector: "Water Security", level: "critical", score: 1 }),
          sector({ province_code: "PG09", sector: "Food Security", level: "low", score: 0.1 }),
        ],
      }),
    );
    expect(m.provinces[0].name).toBe("Enga"); // PG08 critical sorts first
    expect(m.provinces[0].level).toBe("CRITICAL");
    expect(m.provincesAtRisk).toBe(1);
  });

  it("summary leads with alert · ENSO · rating and the top mover", () => {
    const m = buildSitrepModel(
      inputs({
        national: national({ alert_level: "RED", enso_phase: "el_nino_alert", national_risk_rating: "high", high_risk_province_count: 2 }),
        sectorRisk: [sector({ province_code: "PG08", sector: "Water Security", level: "critical", score: 1 })],
      }),
    );
    expect(m.summary).toMatch(/^RED · El Niño Alert · national risk HIGH\./);
    expect(m.summary).toMatch(/Enga · Water Security · CRITICAL/);
    expect(m.summary).toMatch(/2 focus province\(s\) at high risk\./);
  });

  it("indicator null value renders as em-dash, not 'null'", () => {
    const m = buildSitrepModel(
      inputs({
        indicators: [
          { key: "ONI", label: "ONI", value: null, unit: "", source: "x", update_frequency: "monthly", provenance: "DEMO", observed_at: "2026-01-01", trend: "flat" },
        ],
      }),
    );
    expect(m.indicators[0].value).toBe("—");
  });
});

describe("renderSitrepHtml", () => {
  it("escapes the analyst note — no raw markup injection", () => {
    const m = buildSitrepModel(inputs({ analystNote: "<script>alert(1)</script>" }));
    const html = renderSitrepHtml(m);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
