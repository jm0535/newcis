/**
 * USGS earthquakes — seismic tempo for the PNG bounding box.
 *
 * PNG sits on the Ring of Fire; earthquakes are a standing hazard, not a
 * seasonal one. The USGS FDSNWS event service is fully keyless and returns
 * RFC-7946 GeoJSON for any bbox + time window. We pull M4.5+ events for the
 * last 30 days, count them, and:
 *   - emit a national SEISMIC indicator (count → GREEN/AMBER/RED/BLACK via
 *     risk_thresholds.json), and
 *   - emit Disaster & Hazard + Infrastructure SectorRisk rows for the four
 *     focus provinces.
 *
 * Province attribution: USGS gives precise epicentres ([lon, lat]). When the
 * caller supplies province polygons (from provinces.geojson) we ray-cast each
 * epicentre into its containing province and count events *per province* — so a
 * province with a swarm reads RED while a quiet neighbour stays GREEN. This is a
 * genuine spatial join, not a replicated national figure. If polygons are
 * absent (geojson missing) we degrade to the prior national signal applied
 * uniformly, and the caption says so — honest either way.
 */
import type { Indicator, SectorRisk } from "../../src/lib/types";
import { provinceForPoint, type ProvincePolygon } from "../geo";

// PNG bounding box (matches the map extent in HeatMap.tsx).
const PNG_BBOX = { minLat: -11.7, maxLat: -1.3, minLon: 140.8, maxLon: 155.9 };
const MIN_MAGNITUDE = 4.5;
const WINDOW_DAYS = 30;

const ENDPOINT = "https://earthquake.usgs.gov/fdsnws/event/1/query";

interface UsgsFeature {
  properties: { mag: number | null; place: string | null; time: number | null };
  geometry: { coordinates: [number, number, number] };
}

interface UsgsResponse {
  features: UsgsFeature[];
}

/** Count of M4.5+ events → alert level. Mirrors SEISMIC bands in thresholds file. */
function classifyCount(count: number): SectorRisk["level"] {
  if (count > 45) return "critical";
  if (count > 25) return "high";
  if (count > 10) return "med";
  return "low";
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface UsgsEarthquakeResult {
  indicator: Indicator;
  sector_rows: SectorRisk[];
  count: number;
  max_magnitude: number;
  /** Per-focus-province M4.5+ counts when a spatial join ran (else empty). */
  per_province: Record<string, number>;
  /** True if epicentres were attributed by polygon containment. */
  spatial: boolean;
  note: string;
}

/** Infrastructure escalates once a province's own seismic tempo is high. */
function classifyInfra(count: number): SectorRisk["level"] {
  if (count > 25) return "high";
  if (count > 10) return "med";
  return "low";
}

export async function fetchUsgsEarthquakes(
  focusCodes: string[],
  provincePolygons: ProvincePolygon[] = [],
): Promise<UsgsEarthquakeResult> {
  const end = new Date();
  const start = new Date(end.getTime() - WINDOW_DAYS * 24 * 3600 * 1000);
  const params = new URLSearchParams({
    format: "geojson",
    starttime: isoDate(start),
    endtime: isoDate(end),
    minmagnitude: String(MIN_MAGNITUDE),
    minlatitude: String(PNG_BBOX.minLat),
    maxlatitude: String(PNG_BBOX.maxLat),
    minlongitude: String(PNG_BBOX.minLon),
    maxlongitude: String(PNG_BBOX.maxLon),
    orderby: "magnitude",
  });
  const res = await fetch(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`USGS earthquakes: HTTP ${res.status}`);
  const body = (await res.json()) as UsgsResponse;
  const features = body.features ?? [];

  const count = features.length;
  const maxMag = features.reduce((m, f) => Math.max(m, f.properties.mag ?? 0), 0);
  const observedAt = new Date().toISOString();

  const indicator: Indicator = {
    key: "SEISMIC",
    label: "Seismic tempo (M4.5+ events, PNG)",
    unit: `count / ${WINDOW_DAYS}d`,
    source: "USGS FDSNWS earthquake catalogue",
    update_frequency: "continuous (polled per cycle)",
    provenance: "LIVE",
    value: count,
    observed_at: observedAt,
    trend: "flat", // computed by the orchestrator against readings_history
  };

  // Spatial join: attribute each epicentre to its containing province. We only
  // need counts for the focus provinces, but we attribute against all polygons
  // so an event in a non-focus province isn't mis-assigned to a focus one.
  const spatial = provincePolygons.length > 0;
  const focusSet = new Set(focusCodes);
  const perProvince: Record<string, number> = {};
  for (const code of focusCodes) perProvince[code] = 0;

  if (spatial) {
    for (const f of features) {
      const coords = f.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;
      const code = provinceForPoint([coords[0], coords[1]], provincePolygons);
      if (code && focusSet.has(code)) perProvince[code] += 1;
    }
  }

  const sector_rows: SectorRisk[] = [];

  if (spatial) {
    // Per-province counts → per-province levels. A province with no epicentres
    // reads GREEN/low honestly; a swarm escalates only where it actually struck.
    for (const code of focusCodes) {
      const n = perProvince[code];
      const caption = `USGS · ${n} M4.5+ epicentre${n === 1 ? "" : "s"} in this province / ${WINDOW_DAYS}d`;
      sector_rows.push({
        province_code: code,
        sector: "Disaster & Hazard",
        level: classifyCount(n),
        score: Math.min(1, n / 45),
        trend: "flat",
        provenance: "LIVE",
        as_of: observedAt,
        data_source: caption,
      });
      sector_rows.push({
        province_code: code,
        sector: "Infrastructure",
        level: classifyInfra(n),
        score: Math.min(0.5, n / 90),
        trend: "flat",
        provenance: "LIVE",
        as_of: observedAt,
        data_source: caption,
      });
    }
  } else {
    // Degraded mode: no polygons → national signal applied uniformly, labelled.
    const level = classifyCount(count);
    const score = Math.min(1, count / 45);
    const caption = `USGS · ${count} M4.5+ in ${WINDOW_DAYS}d, max M${maxMag.toFixed(1)} (PNG-wide)`;
    for (const code of focusCodes) {
      sector_rows.push({
        province_code: code,
        sector: "Disaster & Hazard",
        level,
        score,
        trend: "flat",
        provenance: "LIVE",
        as_of: observedAt,
        data_source: caption,
      });
      sector_rows.push({
        province_code: code,
        sector: "Infrastructure",
        level: classifyInfra(count),
        score: Math.min(0.5, count / 90),
        trend: "flat",
        provenance: "LIVE",
        as_of: observedAt,
        data_source: caption,
      });
    }
  }

  return {
    indicator,
    sector_rows,
    count,
    max_magnitude: maxMag,
    per_province: perProvince,
    spatial,
    note:
      count === 0
        ? `No M${MIN_MAGNITUDE}+ events in the ${WINDOW_DAYS}-day PNG window — seismically quiet period.`
        : spatial
          ? `${count} M${MIN_MAGNITUDE}+ events (max M${maxMag.toFixed(1)}) attributed across ${focusCodes.length} focus provinces`
          : `${count} M${MIN_MAGNITUDE}+ events (max M${maxMag.toFixed(1)}) → ${classifyCount(count)} (national, no polygons)`,
  };
}
