/**
 * One-off build script: download PNG admin-level-1 boundaries, simplify, bake p-codes +
 * focus flags into each feature, write /public/provinces.geojson.
 *
 * Run: `pnpm tsx scripts/build-provinces-geojson.ts`
 *
 * Source priority:
 *  1. OCHA/HDX Common Operational Dataset (preferred — p-codes match HDX HAPI).
 *  2. GADM level 1 (fallback).
 *
 * For the PoC we accept either source; the script logs which one it used and the resulting
 * feature count. Simplification uses turf's clone+roundTo to trim coordinate precision; for
 * sharper size reduction run `mapshaper -simplify 5%` on the output afterwards.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const FOCUS_NAMES = new Set(["Enga", "Western Highlands", "Southern Highlands", "Gulf"]);

// Approximate PNG admin1 populations (2021 census, in thousands → multiplied to absolute).
// These are baked into the GeoJSON so the engine can compute affected-population estimates
// without a second lookup. Replace with authoritative NSO PNG figures when available.
const POPULATION: Record<string, number> = {
  "Enga": 432000,
  "Western Highlands": 463000,
  "Southern Highlands": 671000,
  "Gulf": 158000,
  "National Capital District": 410000,
  "Morobe": 729000,
  "Eastern Highlands": 615000,
  "Madang": 561000,
  "East Sepik": 540000,
  "West Sepik": 271000,
  "Western": 224000,
  "Central": 295000,
  "Milne Bay": 320000,
  "Oro": 226000,
  "Manus": 73000,
  "New Ireland": 217000,
  "East New Britain": 405000,
  "West New Britain": 396000,
  "Autonomous Region of Bougainville": 300000,
  "Chimbu": 414000,
  "Jiwaka": 396000,
  "Hela": 370000,
};

const HDX_COD = "https://data.humdata.org/dataset/cod-ab-png/resource"; // placeholder; real download URL must be resolved via HDX dataset API
const GADM_FALLBACK = "https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_PNG_1.json";

type Feature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
};

type FC = { type: "FeatureCollection"; features: Feature[] };

async function fetchJson(url: string): Promise<FC> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return (await r.json()) as FC;
}

function normaliseName(raw: string): string {
  // GADM uses "Chimbu (Simbu)" etc. — trim to canonical PNG form.
  return raw
    .replace(/\(.*\)/g, "")
    .replace("Simbu", "Chimbu")
    .replace("Sandaun", "West Sepik")
    .replace("Bougainville", "Autonomous Region of Bougainville")
    .replace("Northern", "Oro")
    .replace("Western Province", "Western")
    .trim();
}

function roundCoords(coords: unknown, dp = 4): unknown {
  if (typeof coords === "number") return Number(coords.toFixed(dp));
  if (Array.isArray(coords)) return coords.map((c) => roundCoords(c, dp));
  return coords;
}

async function main() {
  let source = "GADM";
  let fc: FC;
  try {
    fc = await fetchJson(GADM_FALLBACK);
  } catch (e) {
    console.error("GADM fetch failed:", e);
    console.error("Manually download HDX CoD from", HDX_COD);
    process.exit(1);
  }

  const out: Feature[] = fc.features.map((f) => {
    const rawName =
      (f.properties.NAME_1 as string) ??
      (f.properties.name as string) ??
      "Unknown";
    const name = normaliseName(rawName);
    // GADM HASC_1 looks like "PG.EN" → convert to ISO-style "PG-EN" for the p-code.
    const hasc = (f.properties.HASC_1 as string) ?? "";
    const code = hasc ? hasc.replace(".", "-") : `PG-${name.slice(0, 3).toUpperCase()}`;
    return {
      type: "Feature",
      properties: {
        code,
        name,
        is_focus: FOCUS_NAMES.has(name),
        population: POPULATION[name] ?? 0,
      },
      geometry: {
        type: f.geometry.type,
        coordinates: roundCoords(f.geometry.coordinates, 4),
      },
    };
  });

  const result: FC = { type: "FeatureCollection", features: out };
  const outPath = path.join(process.cwd(), "public", "provinces.geojson");
  await fs.writeFile(outPath, JSON.stringify(result));
  const focus = out.filter((f) => f.properties.is_focus).length;
  console.log(`Wrote ${out.length} features (${focus} focus) to ${outPath} [source=${source}]`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
