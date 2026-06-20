// Data shapes for NEWCIS. JSON file storage in PoC; same shapes back a DB in Phase 2.
// Keep these in sync with CLAUDE.md §3.

export type Provenance = "LIVE" | "DEMO" | "REFERENCE";
export type Trend = "up" | "down" | "flat";
export type AlertLevel = "GREEN" | "AMBER" | "RED" | "BLACK";
export type RiskLevel = "low" | "med" | "high" | "critical";

export type Sector =
  | "Food Security"
  | "Water Security"
  | "Public Health"
  | "Economic Stability"
  | "Infrastructure"
  | "Energy Security"
  | "Social Stability"
  | "Disaster & Hazard";

export interface Indicator {
  key: string; // e.g. "ONI"
  label: string;
  unit: string;
  source: string; // human-readable source name
  update_frequency: string; // e.g. "monthly"
  provenance: Provenance;
  value: number | null;
  observed_at: string; // ISO date
  trend: Trend;
}

export interface HistoricalReading {
  key: string;
  value: number;
  observed_at: string; // ISO date
}

export interface RiskThreshold {
  metric: string; // matches Indicator.key
  // Band edges, named for their UPPER bound. For a normal (non-inverted) metric,
  // classifyIndicator escalates as the value RISES past each edge: ≤ green_max is
  // GREEN, (green_max, amber_max] is AMBER, (amber_max, red_max] is RED, and
  // above red_max is BLACK. For inverted metrics (lower = worse, e.g. SOI,
  // RAINFALL_ANOM) the direction flips — the edges are written in the *worse*
  // (more-negative) direction and a value ≤ an edge escalates to that band.
  green_max: number;
  amber_max: number;
  red_max: number;
  inverted?: boolean; // if true, lower values escalate (used for SOI, NDVI, soil moisture)
  // For non-inverted metrics: if true (default) the band is mirrored around 0 — a
  // very negative value is as dangerous as a very positive one (ENSO is symmetric:
  // El Niño AND La Niña both hazardous). Set false for one-sided metrics that can
  // never go negative (e.g. SEISMIC event counts) so charts don't draw phantom
  // negative threshold lines.
  symmetric?: boolean;
  unit?: string;
  notes?: string;
}

export interface SectorRisk {
  province_code: string; // p-code, matches GeoJSON feature.properties.code
  sector: Sector;
  level: RiskLevel;
  score: number; // 0..1
  trend: Trend;
  provenance: Provenance;
  as_of: string; // ISO date
  data_source?: string;
}

export interface NationalStatus {
  enso_phase: "neutral" | "el_nino_watch" | "el_nino_alert" | "la_nina_watch" | "la_nina_alert";
  alert_level: AlertLevel;
  national_risk_rating: RiskLevel;
  affected_population_est: number;
  high_risk_province_count: number;
  forecast_period: string; // e.g. "JJA 2026"
  updated_at: string; // ISO timestamp
}

export interface LastRun {
  started_at: string;
  finished_at: string;
  status: "ok" | "partial" | "failed";
  sources_ok: Record<string, boolean>;
  notes: string;
}

// Structured, render-agnostic content of one report. Both the HTML view and the
// editable .docx export are built from THIS single model — so the two formats can
// never drift. Persisted alongside the report (Sitrep.model) so a download can
// reproduce the exact point-in-time snapshot rather than re-read live data.
export interface SitrepModel {
  id: string;
  generatedAt: string; // ISO
  period: string;
  docTitle: string; // clean, filename-safe ("NEWCIS SITREP <date>")
  enso: string;
  alert: string;
  rating: string;
  summary: string;
  indicators: {
    key: string;
    label: string;
    value: string;
    unit: string;
    provenance: string;
    observedAt: string;
  }[];
  provinces: {
    rank: number;
    name: string;
    code: string;
    level: string; // upper-cased, or "—"
    sector: string;
    stressed: number;
  }[];
  provinceCount: number;
  provincesAtRisk: number;
  movers: string[];
  actions: string[];
  // Exec-first additions. The structured inputs the visuals need are NOT stored
  // here (the SVGs are built at render time) — only the plain-text exec fields.
  bottomLine: string; // the one-sentence executive read; "" when national is null
  confidence: {
    level: string; // GOOD | PARTIAL | LOW
    line: string; // plain-English data-feed confidence
    feeds: { name: string; ok: boolean }[]; // raw OK/FAIL — appendix only
  };
  // World Economic Forum strategic-intelligence context, relevance-ranked for the
  // current picture and written plainly for non-technical executives. Each row is
  // a paraphrase of an OPENLY published WEF output (DEMO provenance), linked back
  // to its public page — never WEF body text, never badged LIVE.
  strategic: {
    title: string; // plain-language headline
    summary: string; // paraphrase, not WEF body text
    relevance: string; // "why it matters here" — ties the global framing to PNG
    scope: string; // sector name, or "National outlook" for whole-of-country tiles
    source: string; // e.g. "WEF Global Risks Report 2025"
    published: string; // YYYY-MM
    url: string;
    provenance: string; // "DEMO" — honesty contract
  }[];
  sources: { name: string; ok: boolean }[];
  analystNote?: string;
}

export interface Sitrep {
  id: string;
  period: string; // e.g. "Week 23, 2026"
  generated_at: string;
  html: string;
  summary: string;
  analyst_note?: string;
  // Optional for back-compat with reports stored before the model was persisted;
  // the .docx route falls back gracefully when absent.
  model?: SitrepModel;
}

// The forecast bundle written by the ingest cycle (data/forecast.json) and read
// by the /forecast page. `model` is the relayed NMME dynamical forecast (null if
// that fetch failed this cycle — the page degrades to the precursor panel). The
// `outlook` field carries the precursor-alignment read (shape in src/lib/outlook).
export interface ForecastModel {
  provenance: "LIVE";
  source: string;
  init_month: string; // ISO YYYY-MM-01 of the forecast init
  target_window: string; // e.g. "MJJ 2026"
  ensemble_mean: number;
  ensemble_min: number;
  ensemble_max: number;
  members: number[]; // per-member projected ONI, for the plume
}

export interface ForecastBundle {
  generated_at: string;
  model: ForecastModel | null;
  // Typed as unknown-ish here to avoid a types.ts → outlook.ts import cycle; the
  // page imports the precise Outlook type from src/lib/outlook directly.
  outlook: import("./outlook").Outlook;
}

export interface ProvinceProperties {
  code: string; // p-code (e.g. "PG-EBR")
  name: string;
  is_focus: boolean;
  population: number;
}

// Minimal GeoJSON shape for the provincial map — a FeatureCollection of
// MultiPolygon features carrying ProvinceProperties. Coordinates are
// [lon, lat] rings. Kept local (no geojson dependency) — the SITREP map
// builder only needs to project these rings to SVG paths.
export interface ProvinceFeature {
  type: "Feature";
  properties: ProvinceProperties;
  geometry: {
    type: "MultiPolygon";
    coordinates: number[][][][]; // [polygon][ring][point][lon,lat]
  };
}

export interface ProvinceFC {
  type: "FeatureCollection";
  features: ProvinceFeature[];
}
