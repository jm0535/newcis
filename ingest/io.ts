/**
 * Ingestion filesystem I/O. The read/write helpers and the static-geometry
 * loaders the pipeline uses, factored out of lib.ts so the orchestration stays
 * focused. No business logic here — just JSON in/out and degrade-on-missing.
 *
 *   /data    — versioned JSON the app reads (indicators, sector risk, …)
 *   /public  — artefacts the client map fetches at runtime (GeoJSON, volcanoes)
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { parseProvincePolygons, type ProvincePolygon } from "./geo";

export const DATA = path.join(process.cwd(), "data");
export const PUBLIC = path.join(process.cwd(), "public");

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA, file), "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.writeFile(path.join(DATA, file), JSON.stringify(value, null, 2) + "\n");
}

// Some artefacts must be fetchable by the client map at runtime (like the static
// GeoJSON), so they live in /public rather than /data.
export async function writePublicJson(file: string, value: unknown): Promise<void> {
  await fs.writeFile(path.join(PUBLIC, file), JSON.stringify(value, null, 2) + "\n");
}

/**
 * Province population by p-code, read from the static provinces.geojson in
 * /public. This is the single source of truth for population, so the national
 * affected-population estimate traces to a real figure per province. Returns an
 * empty map (→ estimate 0) if the file is missing or malformed — never throws.
 */
export async function loadProvincePopulations(): Promise<Record<string, number>> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "public", "provinces.geojson"),
      "utf8",
    );
    const geo = JSON.parse(raw) as {
      features: { properties: { code?: string; population?: number } }[];
    };
    const out: Record<string, number> = {};
    for (const f of geo.features ?? []) {
      const code = f.properties?.code;
      const pop = f.properties?.population;
      if (code && typeof pop === "number" && pop > 0) out[code] = pop;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Province boundary polygons from the static provinces.geojson, for spatial
 * attribution (point-in-polygon). Used to map earthquake epicentres to the
 * province that actually contains them. Returns [] if the file is missing or
 * malformed — callers degrade to a national signal rather than crash.
 */
export async function loadProvincePolygons(): Promise<ProvincePolygon[]> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "public", "provinces.geojson"),
      "utf8",
    );
    return parseProvincePolygons(JSON.parse(raw));
  } catch {
    return [];
  }
}
