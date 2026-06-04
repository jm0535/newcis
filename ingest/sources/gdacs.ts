/**
 * GDACS — Global Disaster Alert and Coordination System (UN/EC).
 *
 * GDACS is a multi-hazard early-warning feed: earthquakes (EQ), tropical
 * cyclones (TC), floods (FL), volcanoes (VO), and droughts (DR). Each active
 * event carries a colour-coded alert level — Green / Orange / Red — that maps
 * 1:1 onto our traffic-light system. Fully keyless.
 *
 * The feed is global; we filter to events whose ISO3 is PNG (or whose epicentre
 * falls inside the PNG bbox, to catch offshore TC/EQ that omit the country tag).
 * GDACS events are national/regional in scope, not admin1 — so we take the worst
 * active PNG alert and apply it to the Disaster & Hazard cell of every focus
 * province. Honest: the caption names the actual event, and the scope is "PNG".
 *
 * Green → low, Orange → high, Red → critical. (No "med" tier in GDACS; the gap
 * between Green and Orange is deliberate — Orange already means "act now".)
 */
import type { SectorRisk } from "../../src/lib/types";

const ENDPOINT = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP";
const PNG_BBOX = { minLat: -11.7, maxLat: -1.3, minLon: 140.8, maxLon: 155.9 };

const HAZARD_LABEL: Record<string, string> = {
  EQ: "Earthquake",
  TC: "Tropical Cyclone",
  FL: "Flood",
  VO: "Volcano",
  DR: "Drought",
};

interface GdacsFeature {
  geometry: { coordinates: [number, number] } | null;
  properties: {
    eventtype: string;
    alertlevel: string; // "Green" | "Orange" | "Red"
    name: string;
    iso3: string | null;
    fromdate: string;
    todate: string;
    severitydata?: { severitytext?: string };
  };
}

interface GdacsResponse {
  features: GdacsFeature[];
}

const ALERT_RANK: Record<string, number> = { green: 0, orange: 1, red: 2 };

function alertToLevel(alert: string): SectorRisk["level"] {
  switch (alert.toLowerCase()) {
    case "red":
      return "critical";
    case "orange":
      return "high";
    default:
      return "low";
  }
}

function inPng(f: GdacsFeature): boolean {
  if ((f.properties.iso3 ?? "").toUpperCase() === "PNG") return true;
  const c = f.geometry?.coordinates;
  if (!c) return false;
  const [lon, lat] = c;
  return (
    lon >= PNG_BBOX.minLon &&
    lon <= PNG_BBOX.maxLon &&
    lat >= PNG_BBOX.minLat &&
    lat <= PNG_BBOX.maxLat
  );
}

export interface GdacsResult {
  sector_rows: SectorRisk[];
  event_count: number;
  worst_alert: string;
  note: string;
}

export async function fetchGdacs(focusCodes: string[]): Promise<GdacsResult> {
  const res = await fetch(ENDPOINT, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`GDACS: HTTP ${res.status}`);
  const body = (await res.json()) as GdacsResponse;
  const pngEvents = (body.features ?? []).filter(inPng);

  // Worst active PNG event drives the cell.
  let worst: GdacsFeature | null = null;
  for (const f of pngEvents) {
    const rank = ALERT_RANK[f.properties.alertlevel.toLowerCase()] ?? 0;
    const worstRank = worst ? (ALERT_RANK[worst.properties.alertlevel.toLowerCase()] ?? 0) : -1;
    if (rank > worstRank) worst = f;
  }

  const observedAt = new Date().toISOString();
  let level: SectorRisk["level"] = "low";
  let caption = "GDACS · no active PNG alerts";
  let worstAlert = "Green";

  if (worst) {
    const p = worst.properties;
    worstAlert = p.alertlevel;
    level = alertToLevel(p.alertlevel);
    const hazard = HAZARD_LABEL[p.eventtype] ?? p.eventtype;
    const sev = p.severitydata?.severitytext ? ` — ${p.severitydata.severitytext}` : "";
    caption = `GDACS · ${p.alertlevel} ${hazard}${sev}`;
  }

  const score = level === "critical" ? 1 : level === "high" ? 0.66 : 0.1;
  const sector_rows: SectorRisk[] = focusCodes.map((code) => ({
    province_code: code,
    sector: "Disaster & Hazard",
    level,
    score,
    trend: "flat",
    provenance: "LIVE",
    as_of: observedAt,
    data_source: caption,
  }));

  return {
    sector_rows,
    event_count: pngEvents.length,
    worst_alert: worstAlert,
    note:
      pngEvents.length === 0
        ? "GDACS: no active PNG hazard events this cycle."
        : `${pngEvents.length} active PNG event(s); worst = ${worstAlert} (${caption})`,
  };
}
