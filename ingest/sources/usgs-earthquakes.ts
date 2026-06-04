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
 * Province attribution: USGS gives precise epicentres, but mapping a quake to
 * a province needs polygon containment we don't do at PoC scale. So this is a
 * *national* seismic signal applied uniformly to the focus provinces — honest,
 * and the data_source caption says "PNG-wide". Production can do the spatial
 * join against provinces.geojson for per-province attribution.
 */
import type { Indicator, SectorRisk } from "../../src/lib/types";

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
  note: string;
}

export async function fetchUsgsEarthquakes(focusCodes: string[]): Promise<UsgsEarthquakeResult> {
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

  const level = classifyCount(count);
  const score = Math.min(1, count / 45);
  const caption = `USGS · ${count} M4.5+ in ${WINDOW_DAYS}d, max M${maxMag.toFixed(1)} (PNG-wide)`;

  // National seismic signal applied uniformly to the focus provinces.
  const sector_rows: SectorRisk[] = [];
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
    // Seismic activity also stresses infrastructure (roads/bridges in the
    // Highlands). Half-weight: only escalate Infrastructure once tempo is high.
    sector_rows.push({
      province_code: code,
      sector: "Infrastructure",
      level: count > 25 ? "med" : "low",
      score: Math.min(0.5, count / 90),
      trend: "flat",
      provenance: "LIVE",
      as_of: observedAt,
      data_source: caption,
    });
  }

  return {
    indicator,
    sector_rows,
    count,
    max_magnitude: maxMag,
    note:
      count === 0
        ? `No M${MIN_MAGNITUDE}+ events in the ${WINDOW_DAYS}-day PNG window — seismically quiet period.`
        : `${count} M${MIN_MAGNITUDE}+ events (max M${maxMag.toFixed(1)}) → ${level}`,
  };
}
