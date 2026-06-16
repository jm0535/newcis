import { describe, expect, it } from "vitest";
import insights from "../data/wef_insights.json";
import type { WefInsight } from "../src/lib/wef";
import type { Sector } from "../src/lib/types";

const ITEMS = insights as WefInsight[];

// Mirror of the Sector union — a `sector`-tagged tile must name a real sector or
// its node-drill match silently never fires.
const VALID_SECTORS: Sector[] = [
  "Food Security",
  "Water Security",
  "Public Health",
  "Economic Stability",
  "Infrastructure",
  "Energy Security",
  "Social Stability",
  "Disaster & Hazard",
];

describe("wef_insights.json", () => {
  it("has at least 5 insight tiles", () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(5);
  });

  it("every tile is DEMO provenance (honest: not LIVE without an API)", () => {
    for (const it of ITEMS) expect(it.provenance).toBe("DEMO");
  });

  it("every url is an https weforum.org link", () => {
    for (const it of ITEMS) {
      expect(it.url).toMatch(/^https:\/\/www\.weforum\.org\//);
    }
  });

  it("every tile has id, title, summary, source, published", () => {
    for (const it of ITEMS) {
      expect(it.id.length).toBeGreaterThan(0);
      expect(it.title.length).toBeGreaterThan(0);
      expect(it.summary.length).toBeGreaterThan(0);
      expect(it.source.length).toBeGreaterThan(0);
      expect(it.published.length).toBeGreaterThan(0);
    }
  });

  it("ids are unique", () => {
    const ids = new Set(ITEMS.map((i) => i.id));
    expect(ids.size).toBe(ITEMS.length);
  });

  it("any sector-tagged tile names a real Sector (else node-drill never matches)", () => {
    for (const it of ITEMS) {
      if (it.sector !== undefined) expect(VALID_SECTORS).toContain(it.sector);
    }
  });

  it("every sector has at least one WEF tile (every node lights up on drill)", () => {
    const tagged = new Set(ITEMS.map((i) => i.sector).filter(Boolean));
    for (const s of VALID_SECTORS) expect(tagged).toContain(s);
  });
});
