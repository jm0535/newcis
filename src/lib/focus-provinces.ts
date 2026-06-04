// Single source of truth for the prototype's focus provinces.
//
// The risk engine is province-agnostic (see risk-engine.ts) — it scales to all
// 22 PNG provinces by data, not code. This file is the *seed set* the prototype
// actually computes + displays. Add a province here and it flows everywhere:
// ingest pulls its climate points, the engine scores it, every page renders it.
//
// `code`       — HDX admin1 p-code; the join key to provinces.geojson + all /data feeds.
// `name`       — full province name (matches the GeoJSON feature `name`).
// `shortLabel` — compact label for dense tables / matrix headers.
// `lon`,`lat`  — a representative interior point, used by the climate-ingest sources
//                (Open-Meteo, NASA POWER) to pull a per-province reading.

export interface FocusProvince {
  code: string;
  name: string;
  shortLabel: string;
  lon: number;
  lat: number;
}

export const FOCUS_PROVINCES: FocusProvince[] = [
  { code: "PG08", name: "Enga", shortLabel: "Enga", lon: 143.71, lat: -5.49 },
  { code: "PG09", name: "Western Highlands", shortLabel: "Western H.", lon: 144.23, lat: -5.86 },
  { code: "PG07", name: "Southern Highlands", shortLabel: "Southern H.", lon: 143.66, lat: -6.15 },
  { code: "PG02", name: "Gulf", shortLabel: "Gulf", lon: 145.78, lat: -7.96 },
  { code: "PG12", name: "Morobe", shortLabel: "Morobe", lon: 146.74, lat: -6.74 },
  { code: "PG14", name: "East Sepik", shortLabel: "East Sepik", lon: 143.63, lat: -4.22 },
  { code: "PG16", name: "Manus", shortLabel: "Manus", lon: 147.0, lat: -2.06 },
  { code: "PG17", name: "New Ireland", shortLabel: "New Ireland", lon: 151.97, lat: -3.42 },
  { code: "PG18", name: "East New Britain", shortLabel: "East New Britain", lon: 151.84, lat: -4.61 },
  { code: "PG20", name: "Autonomous Region of Bougainville", shortLabel: "Bougainville", lon: 155.2, lat: -6.23 },
];

// Derived helpers — every consumer imports from here, so the lists can never drift.
export const FOCUS_CODES: string[] = FOCUS_PROVINCES.map((p) => p.code);

export const FOCUS_NAMES: Record<string, string> = Object.fromEntries(
  FOCUS_PROVINCES.map((p) => [p.code, p.name]),
);

export const FOCUS_SHORT_LABELS: Record<string, string> = Object.fromEntries(
  FOCUS_PROVINCES.map((p) => [p.code, p.shortLabel]),
);

export const FOCUS_COUNT = FOCUS_PROVINCES.length;
