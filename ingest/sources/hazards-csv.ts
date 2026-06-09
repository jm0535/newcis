/**
 * Curated historical-hazard layers — volcanoes, tsunamis, and major disasters
 * (landslides, cyclones, quakes, drought) — compiled by hand into three CSVs in
 * /data and surfaced as toggleable map layers.
 *
 * Provenance: these are NOT a live API pull. They are a curated reference record
 * of significant PNG hazard events, hand-geocoded to the named site. So every
 * hazard carries provenance "REFERENCE" — distinct from a LIVE feed and from
 * DEMO seed values. The credibility rule holds: we never badge curated history
 * as a live reading.
 *
 * Each CSV row → one HazardEvent with a real lon/lat for the named location
 * (volcano summit, lagoon, village, harbour). The coordinate table below is the
 * geocoding source; add a row's location here to place its marker.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const DATA = path.join(process.cwd(), "data");

export type HazardKind = "volcano" | "tsunami" | "disaster";

export interface HazardEvent {
  kind: HazardKind;
  name: string; // headline label for the marker (volcano / event name)
  province: string; // province name(s) as given in the CSV
  location: string; // specific named location ("Sissano Lagoon", "Manam Island")
  date: string; // human date string as given ("July 17, 1998", "1973 – Ongoing")
  year: number | null; // best-effort latest year parsed from the date, for sorting
  details: string; // impact / key-detail prose
  lon: number;
  lat: number;
}

export interface HazardsResult {
  events: HazardEvent[];
  by_kind: Record<HazardKind, number>;
  ungeocoded: string[]; // locations with no coordinate match (skipped) — for honesty
  note: string;
}

// ── Geocoding table ────────────────────────────────────────────────────────
// Curated lon/lat for every named hazard site across the three CSVs. Keyed by a
// normalised location string (lowercase, trimmed). A site missing here is skipped
// and reported in `ungeocoded` rather than placed at a wrong/guessed point.
const SITE_COORDS: Record<string, [number, number]> = {
  // Volcanoes (summit coordinates)
  "titan ridge (submarine)": [147.78, -3.03],
  "ulawun": [151.33, -5.05],
  "bagana": [155.196, -6.137],
  "manam": [145.037, -4.08],
  "kadovar": [144.588, -3.608],
  "tavurvur (rabaul)": [152.2, -4.27],
  "vulcan (rabaul)": [152.14, -4.27],
  "garbuna group": [150.027, -5.416],
  "pago": [150.516, -5.574],
  "long island (motmot vent)": [147.105, -5.314],
  "karkar": [145.976, -4.647],
  "ritter island": [148.115, -5.519],
  "langila": [148.42, -5.525],
  "bam": [144.818, -3.613],
  "mount lamington": [148.15, -8.95],
  "waiowa (goropu)": [149.075, -9.43],

  // Tsunami strike points (the coast / lagoon hit)
  "sissano lagoon, warapu, arop, malol": [142.04, -3.02],
  "kavieng & northern outer islands": [150.8, -2.58],
  "pomio coast, jaquinot bay, rabaul harbour": [151.55, -5.6],
  "simpson harbour (rabaul), buka island": [152.18, -4.2],
  "wewak shoreline, tarau point": [143.63, -3.55],
  "kokopo, kavieng beachfronts": [152.27, -4.35],
  "simpson harbour (rabaul town)": [152.18, -4.2],
  "madang town, coastline within 50km": [145.79, -5.22],
  "buin, panguna coastline": [155.67, -6.74],
  "ritter island, umboi island coast": [147.97, -5.58],
  "kadovar island, schouten islands": [144.588, -3.608],

  // Major disasters (the impact site)
  "outer island margins, solomon sea corridor, baining mountains": [151.5, -4.9],
  "yambali village (maip mulitaka)": [143.62, -5.28],
  "epicenter in hela; widespread throughout the highlands": [142.75, -6.05],
  "tumbi village (near tari)": [142.95, -5.85],
  "popondetta and surrounding river basins": [148.24, -8.76],
  "high-altitude zones (above 2,000m)": [143.9, -5.6],
  "ok tedi & fly river systems": [141.13, -5.21],
  "wahgi valley and highlands highway corridor": [144.95, -5.85],
  "angoram district, lower sepik river": [144.07, -4.06],
  "kavieng coast and manus atolls": [150.8, -2.58],
  "gulf coast and estuary villages": [145.0, -7.95],
  "mumeng, bulolo district": [146.62, -7.1],
  "saki village, goilala district (near tolukuma)": [147.2, -8.27],
};

// ── Minimal CSV parser ──────────────────────────────────────────────────────
// Handles RFC-4180 quoting: fields may contain commas and embedded newlines when
// wrapped in double quotes; "" is an escaped quote. Returns rows of string cells.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      // Skip blank lines (a trailing newline yields a single empty cell).
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

// Best-effort: pull the LATEST 4-digit year from a free-text date string. "1973 –
// Ongoing" → 1973; "August 29, 2014September 19, 1994" → 2014; "April 2026" → 2026.
function latestYear(dateText: string): number | null {
  const years = (dateText.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number);
  if (years.length === 0) return null;
  return Math.max(...years);
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

async function readCsv(file: string): Promise<string[][]> {
  try {
    const text = await fs.readFile(path.join(DATA, file), "utf8");
    const rows = parseCsv(text);
    return rows.slice(1); // drop header
  } catch {
    return [];
  }
}

export async function loadHazards(): Promise<HazardsResult> {
  const events: HazardEvent[] = [];
  const ungeocoded: string[] = [];

  const place = (kind: HazardKind, name: string, province: string, location: string, date: string, details: string) => {
    const coords = SITE_COORDS[norm(location)];
    if (!coords) {
      ungeocoded.push(`${kind}: ${location}`);
      return;
    }
    events.push({
      kind,
      name: name.trim(),
      province: province.trim(),
      location: location.trim(),
      date: date.trim(),
      year: latestYear(date),
      details: details.trim(),
      lon: coords[0],
      lat: coords[1],
    });
  };

  // png_volcanoes.csv: Volcano Name, Province, Region/Island, Dates, Key Details
  for (const r of await readCsv("png_volcanoes.csv")) {
    if (r.length < 5) continue;
    place("volcano", r[0], r[1], r[0], r[3], r[4]); // volcano located AT its own named site
  }

  // png_tsunamis.csv: Date, Cause, Max Wave, Province, Location Hit, Impact
  for (const r of await readCsv("png_tsunamis.csv")) {
    if (r.length < 6) continue;
    const wave = r[2] ? ` · max wave ${r[2]}` : "";
    place("tsunami", `Tsunami — ${r[1]}`, r[3], r[4], r[0], `${r[5]}${wave}`);
  }

  // png_major_disasters.csv: Date, Type, Province, Location, Impact
  for (const r of await readCsv("png_major_disasters.csv")) {
    if (r.length < 5) continue;
    place("disaster", r[1], r[2], r[3], r[0], r[4]);
  }

  // Newest first within each kind.
  events.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

  const by_kind: Record<HazardKind, number> = { volcano: 0, tsunami: 0, disaster: 0 };
  for (const e of events) by_kind[e.kind]++;

  return {
    events,
    by_kind,
    ungeocoded,
    note: `hazards: ${by_kind.volcano} volcanoes, ${by_kind.tsunami} tsunamis, ${by_kind.disaster} major disasters${
      ungeocoded.length ? `; ${ungeocoded.length} ungeocoded (skipped)` : ""
    }`,
  };
}
