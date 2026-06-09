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

export interface ProvinceProperties {
  code: string; // p-code (e.g. "PG-EBR")
  name: string;
  is_focus: boolean;
  population: number;
}
