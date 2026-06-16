import { describe, expect, it } from "vitest";
import insights from "../data/wef_insights.json";
import type { WefInsight } from "../src/lib/wef";

const ITEMS = insights as WefInsight[];

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
});
