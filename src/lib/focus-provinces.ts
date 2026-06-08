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

// FULL national coverage: all 22 PNG provinces are now the focus set. The risk
// engine + ingest iterate this list, so every province here flows through the
// whole pipeline — climate points pulled, sectors scored, every page renders it.
// The first block is the original high-risk seed set (ENSO/highlands + islands);
// the second completes the national picture. Order does not matter (pages sort
// by severity), but it is kept here for readability.
export const FOCUS_PROVINCES: FocusProvince[] = [
  // Original high-risk focus set
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
  // Remaining provinces — completing all 22 for full national coverage
  { code: "PG03", name: "Central", shortLabel: "Central", lon: 146.8836, lat: -9.4283 },
  { code: "PG04", name: "National Capital District", shortLabel: "NCD", lon: 147.0925, lat: -9.5131 },
  { code: "PG05", name: "Milne Bay", shortLabel: "Milne Bay", lon: 153.5119, lat: -11.6174 },
  { code: "PG06", name: "Oro", shortLabel: "Oro", lon: 149.4438, lat: -9.5878 },
  { code: "PG01", name: "Western", shortLabel: "Western", lon: 143.2525, lat: -9.0947 },
  { code: "PG10", name: "Chimbu", shortLabel: "Chimbu", lon: 145.1855, lat: -6.3603 },
  { code: "PG11", name: "Eastern Highlands", shortLabel: "Eastern H.", lon: 146.0616, lat: -6.5586 },
  { code: "PG13", name: "Madang", shortLabel: "Madang", lon: 145.7405, lat: -5.3869 },
  { code: "PG15", name: "West Sepik", shortLabel: "West Sepik", lon: 140.9998, lat: -4.8974 },
  { code: "PG19", name: "West New Britain", shortLabel: "W. New Britain", lon: 149.5031, lat: -6.3244 },
  { code: "PG21", name: "Hela", shortLabel: "Hela", lon: 143.156, lat: -5.7189 },
  { code: "PG22", name: "Jiwaka", shortLabel: "Jiwaka", lon: 144.7359, lat: -6.1032 },
];

// All 22 provinces are now the focus set — these aliases remain so existing
// consumers that imported the "all provinces" view keep working unchanged.
export const ALL_PROVINCES: FocusProvince[] = FOCUS_PROVINCES;

export const ALL_CODES: string[] = ALL_PROVINCES.map((p) => p.code);

// Derived helpers — every consumer imports from here, so the lists can never drift.
export const FOCUS_CODES: string[] = FOCUS_PROVINCES.map((p) => p.code);

export const FOCUS_NAMES: Record<string, string> = Object.fromEntries(
  FOCUS_PROVINCES.map((p) => [p.code, p.name]),
);

export const FOCUS_SHORT_LABELS: Record<string, string> = Object.fromEntries(
  FOCUS_PROVINCES.map((p) => [p.code, p.shortLabel]),
);

export const FOCUS_COUNT = FOCUS_PROVINCES.length;

// Lookups across ALL provinces (full 22) so any consumer rendering whatever
// provinces appear in the data — not just the focus set — can resolve a label.
// The risk matrix is province-count-agnostic: it renders the provinces present
// in sector_risk.json, so these must cover the full national set.
export const ALL_NAMES: Record<string, string> = Object.fromEntries(
  ALL_PROVINCES.map((p) => [p.code, p.name]),
);

export const ALL_SHORT_LABELS: Record<string, string> = Object.fromEntries(
  ALL_PROVINCES.map((p) => [p.code, p.shortLabel]),
);
