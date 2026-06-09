/**
 * Spatial-join tests for the point-in-polygon utility that attributes
 * earthquake epicentres to provinces. Coordinates are [lon, lat] (GeoJSON order).
 */
import { describe, expect, it } from "vitest";
import {
  parseProvincePolygons,
  pointInMultiPolygon,
  provinceForPoint,
  type ProvincePolygon,
} from "../ingest/geo";

// Two non-overlapping unit squares. WEST covers lon [0,1], EAST covers lon [2,3].
const square = (minLon: number): [number, number][] => [
  [minLon, 0],
  [minLon + 1, 0],
  [minLon + 1, 1],
  [minLon, 1],
  [minLon, 0],
];

const WEST: ProvincePolygon = { code: "W", name: "West", polygons: [[square(0)]] };
const EAST: ProvincePolygon = { code: "E", name: "East", polygons: [[square(2)]] };

describe("pointInMultiPolygon", () => {
  it("interior point is inside", () => {
    expect(pointInMultiPolygon([0.5, 0.5], WEST.polygons)).toBe(true);
  });

  it("point outside the polygon is outside", () => {
    expect(pointInMultiPolygon([1.5, 0.5], WEST.polygons)).toBe(false);
  });

  it("a polygon with a hole excludes points in the hole", () => {
    const outer = square(0);
    const hole: [number, number][] = [
      [0.4, 0.4],
      [0.6, 0.4],
      [0.6, 0.6],
      [0.4, 0.6],
      [0.4, 0.4],
    ];
    const withHole: ProvincePolygon = { code: "H", name: "Holed", polygons: [[outer, hole]] };
    expect(pointInMultiPolygon([0.1, 0.1], withHole.polygons)).toBe(true); // in ring, outside hole
    expect(pointInMultiPolygon([0.5, 0.5], withHole.polygons)).toBe(false); // inside the hole
  });

  it("multi-island province: inside either island counts", () => {
    const islands: ProvincePolygon = {
      code: "I",
      name: "Islands",
      polygons: [[square(0)], [square(2)]],
    };
    expect(pointInMultiPolygon([0.5, 0.5], islands.polygons)).toBe(true);
    expect(pointInMultiPolygon([2.5, 0.5], islands.polygons)).toBe(true);
    expect(pointInMultiPolygon([1.5, 0.5], islands.polygons)).toBe(false); // gap between islands
  });
});

describe("provinceForPoint", () => {
  const provinces = [WEST, EAST];

  it("attributes a point to the containing province", () => {
    expect(provinceForPoint([0.5, 0.5], provinces)).toBe("W");
    expect(provinceForPoint([2.5, 0.5], provinces)).toBe("E");
  });

  it("returns null when the point falls outside every province (offshore)", () => {
    expect(provinceForPoint([1.5, 0.5], provinces)).toBeNull();
    expect(provinceForPoint([10, 10], provinces)).toBeNull();
  });
});

describe("parseProvincePolygons", () => {
  it("normalises a Polygon feature into a single-element MultiPolygon", () => {
    const fc = {
      features: [
        {
          properties: { code: "PG01", name: "Test" },
          geometry: { type: "Polygon", coordinates: [square(0)] },
        },
      ],
    };
    const parsed = parseProvincePolygons(fc);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].code).toBe("PG01");
    expect(provinceForPoint([0.5, 0.5], parsed)).toBe("PG01");
  });

  it("passes MultiPolygon geometry through", () => {
    const fc = {
      features: [
        {
          properties: { code: "PG02", name: "Multi" },
          geometry: { type: "MultiPolygon", coordinates: [[square(0)], [square(2)]] },
        },
      ],
    };
    const parsed = parseProvincePolygons(fc);
    expect(parsed[0].polygons).toHaveLength(2);
    expect(provinceForPoint([2.5, 0.5], parsed)).toBe("PG02");
  });

  it("skips features with no code or unusable geometry — never throws", () => {
    const fc = {
      features: [
        { properties: {}, geometry: { type: "Polygon", coordinates: [square(0)] } },
        { properties: { code: "PG03" }, geometry: { type: "Point", coordinates: [0, 0] } },
        { properties: { code: "PG04" } },
      ],
    };
    expect(parseProvincePolygons(fc)).toHaveLength(0);
  });

  it("tolerates malformed input", () => {
    expect(parseProvincePolygons(null)).toEqual([]);
    expect(parseProvincePolygons({})).toEqual([]);
  });
});
