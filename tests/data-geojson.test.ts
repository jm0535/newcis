// tests/data-geojson.test.ts
import { describe, it, expect } from "vitest";
import { getProvincesGeojson } from "../src/lib/data";

describe("getProvincesGeojson", () => {
  it("reads public/provinces.geojson as a FeatureCollection of provinces", async () => {
    const fc = await getProvincesGeojson();
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features.length).toBeGreaterThanOrEqual(22);
    const f = fc.features[0];
    expect(f.geometry.type).toBe("MultiPolygon");
    expect(typeof f.properties.code).toBe("string");
    expect(typeof f.properties.name).toBe("string");
  });
});
