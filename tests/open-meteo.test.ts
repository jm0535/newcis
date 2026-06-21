/**
 * Open-Meteo daily-feed helpers. Pure anomaly-% and storm-day-count math,
 * tested against fixed fixtures. No network.
 */
import { describe, expect, it } from "vitest";
import { anomalyPct, countStormDays, STORM_DAY_MS } from "../ingest/sources/open-meteo";

describe("anomalyPct", () => {
  it("recent above normal → positive %", () => {
    expect(anomalyPct(120, 100)).toBe(20);
  });
  it("recent below normal → negative %", () => {
    expect(anomalyPct(60, 100)).toBe(-40);
  });
  it("rounds to one decimal", () => {
    expect(anomalyPct(31, 30)).toBe(3.3);
  });
  it("zero normal → 0 (no divide-by-zero)", () => {
    expect(anomalyPct(50, 0)).toBe(0);
  });
});

describe("countStormDays", () => {
  it("counts days where ANY province max-wind hits the cutoff", () => {
    const perDayMaxByProvince = [
      [11.0, 4.0],
      [3.0, 5.0],
      [6.0, 17.2],
    ];
    expect(countStormDays(perDayMaxByProvince, STORM_DAY_MS)).toBe(2);
  });
  it("no day reaches the cutoff → 0", () => {
    expect(countStormDays([[5, 6], [7, 8]], STORM_DAY_MS)).toBe(0);
  });
  it("ignores null wind values", () => {
    expect(countStormDays([[null, 12.0], [null, null]], STORM_DAY_MS)).toBe(1);
  });
  it("caps at the window length, not the province count", () => {
    // 22 provinces, 7-day window: a per-[day][province] grid can never exceed 7.
    const byDay = Array.from({ length: 7 }, () =>
      Array.from({ length: 22 }, () => 12.0),
    );
    expect(countStormDays(byDay, STORM_DAY_MS)).toBe(7);
  });
});
