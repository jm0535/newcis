/**
 * SITREP model tests. buildSitrepModel is the pure data→report shaper; these pin
 * the parts an executive reads off the printed page: alert tier → action set,
 * worst-first provincial ranking, summary line, and XSS-safe HTML rendering of
 * the free-text analyst note.
 */
import { describe, expect, it } from "vitest";
import { buildSitrepModel, renderSitrepHtml, type SitrepInputs } from "../src/lib/sitrep";

import { selectStrategicContext } from "../src/lib/sitrep-shared";
import type { NationalStatus, SectorRisk } from "../src/lib/types";
import type { WefInsight } from "../src/lib/wef";

const wef = (over: Partial<WefInsight> & Pick<WefInsight, "id">): WefInsight => ({
  title: "t",
  summary: "s",
  url: "https://www.weforum.org/x",
  source: "WEF Agenda",
  published: "2025-01",
  provenance: "DEMO",
  ...over,
});

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

describe("selectStrategicContext", () => {
  const insights: WefInsight[] = [
    wef({ id: "nat-1" }), // national (no sector) — always shows
    wef({ id: "food", sector: "Food Security" }),
    wef({ id: "water", sector: "Water Security" }),
  ];

  it("always surfaces national-level tiles, even with no stressed sectors", () => {
    const out = selectStrategicContext(insights, []);
    expect(out.map((s) => s.scope)).toEqual(["National outlook"]);
  });

  it("includes a sector tile only when that sector is stressed in a focus province", () => {
    const out = selectStrategicContext(insights, [
      sector({ province_code: "PG08", sector: "Food Security", level: "critical" }),
    ]);
    const scopes = out.map((s) => s.scope);
    expect(scopes).toContain("National outlook");
    expect(scopes).toContain("Food Security");
    expect(scopes).not.toContain("Water Security"); // not stressed → excluded
  });

  it("ignores stress in a non-focus province (engine is focus-seeded)", () => {
    const out = selectStrategicContext(insights, [
      sector({ province_code: "PG99", sector: "Food Security", level: "critical" }),
    ]);
    expect(out.map((s) => s.scope)).not.toContain("Food Security");
  });

  it("national tiles lead, then stressed-sector tiles; honours the cap", () => {
    const out = selectStrategicContext(
      insights,
      [
        sector({ province_code: "PG08", sector: "Food Security", level: "high" }),
        sector({ province_code: "PG08", sector: "Water Security", level: "high" }),
      ],
      2,
    );
    expect(out).toHaveLength(2);
    expect(out[0].scope).toBe("National outlook");
  });

  it("keeps DEMO provenance and a plain-language relevance line", () => {
    const out = selectStrategicContext([wef({ id: "nat-1" })], []);
    expect(out[0].provenance).toBe("DEMO");
    expect(out[0].relevance.length).toBeGreaterThan(0);
  });
});

describe("buildSitrepModel exec fields", () => {
  it("populates bottomLine and confidence", () => {
    const model = buildSitrepModel({
      national: {
        enso_phase: "el_nino_alert",
        alert_level: "RED",
        national_risk_rating: "high",
        affected_population_est: 1000,
        high_risk_province_count: 3,
        forecast_period: "Next 3 months",
        updated_at: "2026-06-20T00:00:00.000Z",
      },
      indicators: [],
      sectorRisk: [],
      lastRun: {
        started_at: "2026-06-20T00:00:00.000Z",
        finished_at: "2026-06-20T00:05:00.000Z",
        status: "partial",
        sources_ok: { a: true, b: true, c: false },
        notes: "",
      },
    });
    expect(model.bottomLine).toContain("national alert is RED");
    expect(model.confidence.level).toBe("PARTIAL");
    expect(model.confidence.feeds).toHaveLength(3);
  });

  it("leaves bottomLine empty when national is null", () => {
    const model = buildSitrepModel({ national: null, indicators: [], sectorRisk: [], lastRun: null });
    expect(model.bottomLine).toBe("");
    expect(model.confidence.level).toBe("LOW");
  });
});

describe("renderSitrepHtml", () => {
  it("escapes the analyst note — no raw markup injection", () => {
    const m = buildSitrepModel(inputs({ analystNote: "<script>alert(1)</script>" }));
    const html = renderSitrepHtml(m, { national: null, sectorRisk: [], history: [], geojson: { type: "FeatureCollection", features: [] } });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders the Strategic Context section when WEF insights are present", () => {
    const m = buildSitrepModel(
      inputs({
        wefInsights: [wef({ id: "nat-1", title: "Global Risks Report 2025" })],
      }),
    );
    const html = renderSitrepHtml(m, { national: null, sectorRisk: [], history: [], geojson: { type: "FeatureCollection", features: [] } });
    expect(html).toContain("Strategic context");
    expect(html).toContain("World Economic Forum");
    expect(html).toContain("Global Risks Report 2025");
  });
});

describe("renderSitrepHtml exec-first government report", () => {
  const national = {
    enso_phase: "el_nino_alert" as const,
    alert_level: "RED" as const,
    national_risk_rating: "high" as const,
    affected_population_est: 1_795_581,
    high_risk_province_count: 3,
    forecast_period: "Next 3 months",
    updated_at: "2026-06-20T00:00:00.000Z",
  };
  const sectorRisk = [
    { province_code: "PG08", sector: "Food Security" as const, level: "critical" as const, score: 0.9, trend: "up" as const, provenance: "LIVE" as const, as_of: "2026-06-20" },
  ];
  const history = [
    { key: "ONI", value: 0.2, observed_at: "2026-01-01" },
    { key: "ONI", value: 0.9, observed_at: "2026-02-01" },
  ];
  const indicators = [
    { key: "ONI", label: "Oceanic Niño Index", unit: "", source: "NOAA", update_frequency: "monthly", provenance: "LIVE" as const, value: 0.9, observed_at: "2026-02-01", trend: "up" as const },
  ];
  const geojson = {
    type: "FeatureCollection" as const,
    features: [
      { type: "Feature" as const, properties: { code: "PG08", name: "Enga", is_focus: true, population: 432000 }, geometry: { type: "MultiPolygon" as const, coordinates: [[[[143, -5], [144, -5], [144, -6], [143, -5]]]] } },
    ],
  };

  it("leads exec-first, embeds the four visuals, and appendices the feed health", () => {
    const model = buildSitrepModel({ national, indicators, sectorRisk, lastRun: { started_at: "", finished_at: "", status: "partial", sources_ok: { noaa_oni: false, hdx_food: true }, notes: "" } });
    const html = renderSitrepHtml(model, { national, sectorRisk, history, geojson });

    // Visuals present.
    const svgCount = (html.match(/<svg /g) ?? []).length;
    expect(svgCount).toBeGreaterThanOrEqual(4);
    // Bottom line present.
    expect(html).toContain("national alert is RED");
    // Confidence line present, NOT the raw dump in the body.
    expect(html).toContain("data feeds reported this cycle");
    // Technical appendix heading present and holds the raw feed status.
    expect(html).toContain("Technical appendix");
    expect(html).toContain("noaa_oni");
    // Exec sections come before the appendix.
    expect(html.indexOf("Bottom line")).toBeLessThan(html.indexOf("Technical appendix"));
  });
});
