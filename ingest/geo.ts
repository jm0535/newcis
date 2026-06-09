/**
 * Geo utilities — pure, no I/O, no external deps.
 *
 * We need to attribute a point (an earthquake epicentre, a hazard centroid) to
 * the PNG province whose polygon contains it. provinces.geojson features are all
 * GeoJSON MultiPolygon. Rather than pull in turf.js for one operation, this is a
 * standard ray-casting point-in-polygon over the MultiPolygon ring structure:
 *
 *   MultiPolygon.coordinates: Polygon[]            (one province may be islands)
 *   Polygon:                  LinearRing[]          (ring[0] outer, ring[1..] holes)
 *   LinearRing:               [lon, lat][]
 *
 * A point is inside the MultiPolygon if it is inside any outer ring and not
 * inside a hole of that same polygon. Coordinates are [lon, lat] (GeoJSON order),
 * matching USGS feature geometry — so no axis-swapping is needed.
 */

export type Position = [number, number]; // [lon, lat]
type LinearRing = Position[];
type Polygon = LinearRing[];
type MultiPolygonCoords = Polygon[];

export interface ProvincePolygon {
  code: string;
  name: string;
  /** Normalised to MultiPolygon coords so a single ray-cast path handles both. */
  polygons: MultiPolygonCoords;
}

/**
 * Ray-casting test: is [lon, lat] inside a single linear ring? Counts how many
 * times a ray cast east from the point crosses the ring's edges; odd = inside.
 * Boundary points are treated as inside (deterministic, good enough for hazard
 * attribution where epicentres land squarely within a province in practice).
 */
function pointInRing(point: Position, ring: LinearRing): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Inside a Polygon = inside its outer ring and outside every hole ring. */
function pointInPolygon(point: Position, polygon: Polygon): boolean {
  if (polygon.length === 0) return false;
  if (!pointInRing(point, polygon[0])) return false;
  for (let h = 1; h < polygon.length; h++) {
    if (pointInRing(point, polygon[h])) return false; // in a hole
  }
  return true;
}

/** Inside a MultiPolygon = inside any of its constituent polygons. */
export function pointInMultiPolygon(point: Position, polygons: MultiPolygonCoords): boolean {
  for (const poly of polygons) {
    if (pointInPolygon(point, poly)) return true;
  }
  return false;
}

/**
 * Return the `code` of the first province polygon containing the point, or null
 * if the point falls outside every province (e.g. offshore epicentre).
 */
export function provinceForPoint(
  point: Position,
  provinces: ProvincePolygon[],
): string | null {
  for (const p of provinces) {
    if (pointInMultiPolygon(point, p.polygons)) return p.code;
  }
  return null;
}

interface GeoFeature {
  properties?: { code?: string; name?: string };
  geometry?: { type?: string; coordinates?: unknown };
}

/**
 * Normalise a provinces.geojson FeatureCollection into ProvincePolygon[].
 * Accepts both Polygon and MultiPolygon geometries (wraps Polygon in a single-
 * element MultiPolygon) so callers have one uniform shape. Skips features with
 * no code or unusable geometry — never throws.
 */
export function parseProvincePolygons(geojson: unknown): ProvincePolygon[] {
  const fc = geojson as { features?: GeoFeature[] };
  const out: ProvincePolygon[] = [];
  for (const f of fc?.features ?? []) {
    const code = f.properties?.code;
    if (!code) continue;
    const name = f.properties?.name ?? code;
    const geomType = f.geometry?.type;
    const coords = f.geometry?.coordinates;
    if (!Array.isArray(coords)) continue;
    let polygons: MultiPolygonCoords;
    if (geomType === "MultiPolygon") {
      polygons = coords as MultiPolygonCoords;
    } else if (geomType === "Polygon") {
      polygons = [coords as Polygon];
    } else {
      continue;
    }
    out.push({ code, name, polygons });
  }
  return out;
}
