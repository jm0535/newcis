/**
 * NASA EONET (Earth Observatory Natural Event Tracker) — unified hazard feed.
 *
 * EONET is NASA's keyless, near-real-time curated index of natural events drawn
 * from many authoritative sources (Smithsonian volcanoes, GDACS, InciWeb fires,
 * etc.), each event geolocated and timestamped. It is the SINGLE-PANE hazard
 * layer: where GVP gives us only volcanoes and GDACS only its own alerts, EONET
 * unifies volcanoes, severe storms, floods, drought, wildfires and landslides
 * into one geolocated stream. We pull OPEN (active) PNG-region events and
 * attribute each to the province that contains its most recent point (with a
 * nearest-province fallback for offshore points), then score each province's
 * Disaster & Hazard cell by its most severe active event.
 *
 * Why EONET alongside GVP/GDACS: it catches event types those feeds miss (e.g.
 * floods and severe storms) and corroborates the ones they share, so a province
 * with a live EONET flood gets a real hazard reading even when no volcano or
 * GDACS alert is present. The orchestrator max-merges all Disaster & Hazard
 * sources, so EONET only ever raises a province's level, never masks a worse one.
 *
 * Every row is LIVE (a real active event pulled this cycle); the caption names
 * the event and its category so "why is this province amber?" reduces to one
 * fact: "EONET · severe storm (active)".
 *
 * Endpoint (EONET v3):
 *   https://eonet.gsfc.nasa.gov/api/v3/events?status=open&bbox=130,0,160,-12
 *   (bbox is minLon,maxLat,maxLon,minLat — PNG + surrounding seas)
 */
import type { SectorRisk } from "../../src/lib/types";
import { provinceForPoint, type ProvincePolygon } from "../geo";

const EONET_BASE = "https://eonet.gsfc.nasa.gov/api/v3/events";
// PNG bounding box in EONET's (minLon, maxLat, maxLon, minLat) order.
const PNG_BBOX = "130,0,160,-12";

interface EonetCategory {
  id: string;
  title: string;
}

interface EonetGeometry {
  date: string;
  type: string;
  coordinates: number[]; // [lon, lat] for Point
}

interface EonetEvent {
  id: string;
  title: string;
  closed: string | null;
  categories: EonetCategory[];
  geometry: EonetGeometry[];
}

interface EonetResponse {
  events?: EonetEvent[];
}

const LEVEL_RANK: Record<SectorRisk["level"], number> = {
  low: 0,
  med: 1,
  high: 2,
  critical: 3,
};

/**
 * Hazard category → Disaster & Hazard level for an ACTIVE event. EONET does not
 * carry a severity magnitude for most categories, so the level reflects the
 * intrinsic acute danger of an active event of that type to the focus provinces:
 *   - volcanoes, severe storms, floods → high (acute, fast-onset, life-threatening)
 *   - landslides → high (PNG's terrain makes these deadly)
 *   - wildfires → med (real but slower / more contained in PNG's wet highlands)
 *   - drought → med (slow-onset; the ENSO climate gauges already carry the detail)
 *   - anything else → low (presence only)
 */
function categoryLevel(categoryId: string): SectorRisk["level"] {
  switch (categoryId) {
    case "volcanoes":
    case "severeStorms":
    case "floods":
    case "landslides":
      return "high";
    case "wildfires":
    case "drought":
      return "med";
    default:
      return "low";
  }
}

/**
 * EONET names geolocatable events "<Type> in <Country> <id>" (e.g. "Wildfire in
 * Australia 1022955"). When an event's title explicitly names a country OTHER
 * than PNG, it is a foreign event — even if its point falls just inside our
 * generous bbox or near a PNG province. The bbox clips Australia's Top End, so
 * without this guard an Australian wildfire would be force-attributed to a PNG
 * border province (Western, Manus) via the nearest-province fallback and
 * captioned as a PNG hazard — a provenance lie. We only ever let a foreign-titled
 * event through if it actually CONTAINS a PNG province polygon (an unambiguous
 * geometric hit overrides the title), never on the nearest-province fallback.
 */
function isForeignTitled(title: string): boolean {
  const m = /\bin\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\b/.exec(title);
  if (!m) return false;
  const place = m[1].trim();
  return place !== "Papua New Guinea";
}

/** Most recent point of an event ([lon, lat]), or null if it has no Point. */
function latestPoint(ev: EonetEvent): [number, number] | null {
  const points = ev.geometry
    .filter((g) => g.type === "Point" && Array.isArray(g.coordinates) && g.coordinates.length >= 2)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (points.length === 0) return null;
  const last = points[points.length - 1];
  return [last.coordinates[0], last.coordinates[1]];
}

// Max nearest-province attribution radius (degrees). The EONET bbox is generous
// (it reaches into the Coral/Bismarck/Arafura seas and clips Australia's Top End),
// so an event that contains-tests outside every PNG province AND sits more than
// this far from the nearest province interior point is NOT a PNG hazard — drop it
// rather than force-attribute a foreign wildfire onto a focus province. ~3° (~330km)
// keeps genuinely-offshore PNG events while rejecting Australian/Indonesian ones.
const MAX_NEAREST_DEG = 3;

/** Nearest province within MAX_NEAREST_DEG; null if every province is too far. */
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
  return bestD <= MAX_NEAREST_DEG ** 2 ? best : null;
}

export interface EonetEventRecord {
  id: string;
  title: string;
  categoryId: string;
  categoryTitle: string;
  lon: number;
  lat: number;
  provinceCode: string;
  attribution: "contains" | "nearest";
}

export interface NasaEonetResult {
  sector_rows: SectorRisk[];
  events: EonetEventRecord[];
  note: string;
}

export async function fetchNasaEonet(
  focusCodes: string[],
  provincePolygons: ProvincePolygon[],
  provinceReps: { code: string; lon: number; lat: number }[],
): Promise<NasaEonetResult> {
  const url = `${EONET_BASE}?status=open&bbox=${PNG_BBOX}`;
  const res = await fetch(url, {
    headers: { "user-agent": "newcis-ingest/0.1", accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`NASA EONET: HTTP ${res.status}`);
  const body = (await res.json()) as EonetResponse;
  const rawEvents = body.events ?? [];

  const focusSet = new Set(focusCodes);
  const observedAt = new Date().toISOString();

  // 1. Attribute every open event to a province by its most recent point.
  const events: EonetEventRecord[] = [];
  for (const ev of rawEvents) {
    if (ev.closed) continue; // defensive: only active events
    const pt = latestPoint(ev);
    if (!pt) continue;
    const [lon, lat] = pt;
    let provinceCode = provinceForPoint([lon, lat], provincePolygons);
    let attribution: EonetEventRecord["attribution"] = "contains";
    if (!provinceCode) {
      // Foreign-titled events get NO nearest-province fallback — only an exact
      // polygon containment (above) can attribute them, so an Australian fire
      // near the border is dropped rather than mislabelled as a PNG hazard.
      if (isForeignTitled(ev.title)) continue;
      provinceCode = nearestProvince(lon, lat, provinceReps);
      attribution = "nearest";
    }
    if (!provinceCode) continue;
    const cat = ev.categories[0];
    events.push({
      id: ev.id,
      title: ev.title,
      categoryId: cat?.id ?? "unknown",
      categoryTitle: cat?.title ?? "Event",
      lon,
      lat,
      provinceCode,
      attribution,
    });
  }

  // 2. Per province: keep the most severe active event.
  const worstByProvince = new Map<
    string,
    { rec: EonetEventRecord; level: SectorRisk["level"] }
  >();
  for (const e of events) {
    if (!focusSet.has(e.provinceCode)) continue;
    const level = categoryLevel(e.categoryId);
    const cur = worstByProvince.get(e.provinceCode);
    if (!cur || LEVEL_RANK[level] > LEVEL_RANK[cur.level]) {
      worstByProvince.set(e.provinceCode, { rec: e, level });
    }
  }

  // 3. Emit one Disaster & Hazard row per province with an active event. A
  //    province with no EONET event emits nothing (the engine keeps its other-
  //    source value) — honest: we don't invent hazard where EONET sees none.
  const sector_rows: SectorRisk[] = [];
  for (const code of focusCodes) {
    const hit = worstByProvince.get(code);
    if (!hit) continue;
    const { rec, level } = hit;
    const near = rec.attribution === "nearest" ? " (nearby, nearest province)" : "";
    const score = LEVEL_RANK[level] * 0.25 + 0.12; // within-band, above green backgrounds
    sector_rows.push({
      province_code: code,
      sector: "Disaster & Hazard",
      level,
      score: Math.min(0.999, score),
      trend: "flat",
      provenance: "LIVE",
      as_of: observedAt,
      data_source: `EONET · ${rec.categoryTitle.toLowerCase()} (active): ${rec.title}${near}`,
    });
  }

  return {
    sector_rows,
    events,
    note: `NASA EONET: ${events.length} active PNG-region events across ${worstByProvince.size} focus provinces`,
  };
}

// CLI smoke test: `pnpm tsx ingest/sources/nasa-eonet.ts`
if (process.argv[1] && process.argv[1].endsWith("nasa-eonet.ts")) {
  const reps = [
    { code: "PG08", lon: 143.1, lat: -5.5 },
    { code: "PG07", lon: 143.5, lat: -6.5 },
    { code: "PG09", lon: 144.2, lat: -5.8 },
    { code: "PG02", lon: 145.0, lat: -7.5 },
  ];
  fetchNasaEonet(["PG07", "PG08", "PG09", "PG02"], [], reps).then(
    (r) => console.log(JSON.stringify(r, null, 2)),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
