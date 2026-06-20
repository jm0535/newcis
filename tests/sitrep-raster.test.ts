// tests/sitrep-raster.test.ts
import { describe, it, expect } from "vitest";
import { svgToPng } from "../src/lib/sitrep-raster";

describe("svgToPng", () => {
  it("rasterizes an svg to a non-empty PNG buffer", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20"><rect width="20" height="20" fill="#22c55e"/></svg>';
    const png = await svgToPng(svg, 200);
    expect(png.length).toBeGreaterThan(0);
    // PNG magic number.
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
  });
});
