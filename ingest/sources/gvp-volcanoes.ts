/**
 * Smithsonian Global Volcanism Program (GVP) — per-province volcano hazard.
 *
 * GVP's Volcanoes of the World (VOTW) catalogue is the authoritative, keyless
 * record of every Holocene volcano with coordinates and a last-eruption year.
 * We pull the PNG set from GVP's GeoServer WFS (GeoJSON), spatially join each
 * volcano to the province that contains it (point-in-polygon; nearest-province
 * fallback for offshore/submarine cones like Titan Ridge in the Bismarck Sea),
 * and score each province's Disaster & Hazard cell by its most-active volcano.
 *
 * Why GVP, not GDACS, as the primary signal: GDACS's volcano (VO) feed is
 * sparse and intermittent — submarine eruptions frequently never appear in it.
 * GVP's `Last_Eruption_Year` is the reliable recency signal (it already carries
 * 2026 eruptions for Manam, Langila, Bagana). GDACS VO alerts, when present,
 * are layered on top as a live escalation in the orchestrator.
 *
 * Recency → level (worst volcano per province):
 *   erupting this year (yr >= currentYear-?)   → high   (active)
 *   erupted within ~10 yrs                      → med    (restless)
 *   erupted within ~150 yrs (historical)        → low    (active in record)
 *   older / unknown                             → low    (presence only)
 *
 * Every row is LIVE (a real catalogue value pulled this cycle); the caption
 * names the volcano and its last-eruption year so "why is Madang amber?" reduces
 * to one fact: "Manam stratovolcano, last erupted 2026."
 */
import type { SectorRisk } from "../../src/lib/types";
import { provinceForPoint, type ProvincePolygon } from "../geo";

const WFS_BASE = "https://webservices.volcano.si.edu/geoserver/GVP-VOTW/wfs";
const LAYER = "GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes";

// Recency windows (years). Tuned so an eruption in the current year reads as an
// active hazard, the last decade as restless, and the historical record as a
// standing (low) hazard rather than silence.
const ACTIVE_WINDOW_YEARS = 2; // erupting now / very recently → high
const RESTLESS_WINDOW_YEARS = 10; // restless → med
const HISTORICAL_WINDOW_YEARS = 150; // active in the modern record → low (flagged)

interface GvpProperties {
  Volcano_Name: string;
  Primary_Volcano_Type: string | null;
  Last_Eruption_Year: number | null;
  Country: string | null;
}

interface GvpFeature {
  geometry: { coordinates: [number, number] } | null;
  properties: GvpProperties;
}

interface GvpResponse {
  features: GvpFeature[];
}

export interface VolcanoRecord {
  name: string;
  type: string;
  lastEruptionYear: number | null;
  lon: number;
  lat: number;
  provinceCode: string; // attributed (containing or nearest) province
  attribution: "contains" | "nearest"; // honesty: was it inside a polygon or nearest?
}

const LEVEL_RANK: Record<SectorRisk["level"], number> = {
  low: 0,
  med: 1,
  high: 2,
  critical: 3,
};

/** Recency of the last eruption → Disaster & Hazard level for one volcano. */
export function recencyLevel(lastEruptionYear: number | null, currentYear: number): SectorRisk["level"] {
  if (lastEruptionYear === null) return "low"; // in the record but no dated eruption
  const age = currentYear - lastEruptionYear;
  if (age <= ACTIVE_WINDOW_YEARS) return "high";
  if (age <= RESTLESS_WINDOW_YEARS) return "med";
  if (age <= HISTORICAL_WINDOW_YEARS) return "low";
  return "low";
}

/** Per-volcano score, graduated within its level band (sort tiebreaker). */
export function volcanoScore(level: SectorRisk["level"], lastEruptionYear: number | null, currentYear: number): number {
  const base = LEVEL_RANK[level] * 0.25;
  // A real, named volcano in a province is a more specific hazard than a generic
  // green regional alert, so its caption ("why is this province at this level?")
  // should win the max-merge tie against a same-level background signal — e.g.
  // GDACS green earthquake, whose score is 0.1. We give the volcano an absolute
  // within-band score FLOOR just above that, then add graduated freshness on top.
  // The floor stays well inside the band's 0.25 width, so it never crosses a level.
  const FLOOR = 0.11; // absolute score offset above GDACS green (0.1)
  const age = lastEruptionYear === null ? Infinity : Math.max(0, currentYear - lastEruptionYear);
  // Fresher within the band → higher in the quarter. Saturates softly with age.
  const freshness = Number.isFinite(age) ? 1 / (1 + age / 5) : 0; // 1 at age 0, →0 as age grows
  const graduated = Math.min(0.999, freshness) * 0.25; // 0..~0.25
  return base + Math.max(FLOOR, graduated);
}

/** Nearest province by squared distance to its representative interior point. */
function nearestProvince(
  lon: number,
  lat: number,
  reps: { code: string; lon: number; lat: number }[],
): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const r of reps) {
    const d = (r.lon - lon) ** 2 + (r.lat - lat) ** 2;
    if (d < bestD) {
      bestD = d;
      best = r.code;
    }
  }
  return best;
}

export interface GvpVolcanoResult {
  sector_rows: SectorRisk[];
  /** All PNG volcanoes attributed to a province (for notes / debugging). */
  volcanoes: VolcanoRecord[];
  /** Volcanoes erupting within the active window, by province. */
  active_by_province: Record<string, string[]>;
  note: string;
}

/**
 * @param focusCodes      provinces to emit rows for
 * @param provincePolygons province boundary polygons (point-in-polygon join)
 * @param provinceReps     representative interior points for the nearest-province fallback
 */
export async function fetchGvpVolcanoes(
  focusCodes: string[],
  provincePolygons: ProvincePolygon[],
  provinceReps: { code: string; lon: number; lat: number }[],
): Promise<GvpVolcanoResult> {
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeName: LAYER,
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    CQL_FILTER: "Country='Papua New Guinea'",
  });
  const res = await fetch(`${WFS_BASE}?${params}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`GVP volcanoes: HTTP ${res.status}`);
  const body = (await res.json()) as GvpResponse;
  const features = body.features ?? [];

  const currentYear = new Date().getUTCFullYear();
  const focusSet = new Set(focusCodes);
  const observedAt = new Date().toISOString();

  // 1. Attribute every PNG volcano to a province.
  const volcanoes: VolcanoRecord[] = [];
  for (const f of features) {
    const coords = f.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const [lon, lat] = coords;
    let provinceCode = provinceForPoint([lon, lat], provincePolygons);
    let attribution: VolcanoRecord["attribution"] = "contains";
    if (!provinceCode) {
      provinceCode = nearestProvince(lon, lat, provinceReps);
      attribution = "nearest";
    }
    if (!provinceCode) continue;
    volcanoes.push({
      name: f.properties.Volcano_Name,
      type: f.properties.Primary_Volcano_Type ?? "volcano",
      lastEruptionYear: f.properties.Last_Eruption_Year,
      lon,
      lat,
      provinceCode,
      attribution,
    });
  }

  // 2. Per province: pick the worst (most-active, then freshest) volcano.
  const worstByProvince = new Map<string, { rec: VolcanoRecord; level: SectorRisk["level"]; score: number }>();
  const activeByProvince: Record<string, string[]> = {};
  for (const v of volcanoes) {
    if (!focusSet.has(v.provinceCode)) continue;
    const level = recencyLevel(v.lastEruptionYear, currentYear);
    const score = volcanoScore(level, v.lastEruptionYear, currentYear);
    if (level === "high") {
      (activeByProvince[v.provinceCode] ||= []).push(v.name);
    }
    const cur = worstByProvince.get(v.provinceCode);
    if (!cur || LEVEL_RANK[level] > LEVEL_RANK[cur.level] || (LEVEL_RANK[level] === LEVEL_RANK[cur.level] && score > cur.score)) {
      worstByProvince.set(v.provinceCode, { rec: v, level, score });
    }
  }

  // 3. Emit one Disaster & Hazard row per province that actually has a volcano.
  //    Provinces with no catalogued volcano emit nothing (the engine keeps their
  //    seed/other-source value) — honest: we don't invent volcano risk where
  //    there is no volcano.
  const sector_rows: SectorRisk[] = [];
  for (const code of focusCodes) {
    const hit = worstByProvince.get(code);
    if (!hit) continue;
    const { rec, level, score } = hit;
    const yr = rec.lastEruptionYear === null ? "no dated eruption" : `last erupted ${rec.lastEruptionYear}`;
    const near = rec.attribution === "nearest" ? " (offshore, nearest province)" : "";
    sector_rows.push({
      province_code: code,
      sector: "Disaster & Hazard",
      level,
      score,
      trend: "flat",
      provenance: "LIVE",
      as_of: observedAt,
      data_source: `GVP · ${rec.name} ${rec.type.toLowerCase()}, ${yr}${near}`,
    });
  }

  const activeProvinces = Object.keys(activeByProvince);
  const activeNote =
    activeProvinces.length === 0
      ? "no PNG volcano erupting in the active window this cycle"
      : `active: ${activeProvinces
          .map((c) => `${c} (${activeByProvince[c].join(", ")})`)
          .join("; ")}`;

  return {
    sector_rows,
    volcanoes,
    active_by_province: activeByProvince,
    note: `GVP: ${volcanoes.length} PNG volcanoes across ${worstByProvince.size} focus provinces; ${activeNote}`,
  };
}
