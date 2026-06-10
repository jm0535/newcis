/**
 * Parser tests for the shared NOAA CPC monthly-grid format used by SOI and the
 * 850 mb trade-wind index. The two tricky cases the real feeds exhibit:
 *   - future months filled with the -999.9 sentinel (must be dropped)
 *   - cells running together with no space before a negative ("-0.9-999.9")
 *     (must still tokenise as two separate values)
 */
import { describe, expect, it } from "vitest";
import { parseMonthlyGrid, gridTrend } from "../ingest/sources/noaa-cpc-grid";

// Mirrors the real CPC layout: title/header lines then YEAR + 12 monthly cells.
const SAMPLE = `   850 MB TRADE WIND INDEX(135E-180W)5N 5S  WEST PACIFIC
                    ORIGINAL        DATA
YEAR   JAN   FEB   MAR   APR   MAY   JUN   JUL   AUG   SEP   OCT   NOV   DEC
2024   0.6   0.1   1.0   1.2   0.5   0.6   0.7   1.0   0.5   0.9   1.6   2.2
2025   1.8   1.4   2.4   1.3   1.0   0.6   0.9   0.9   1.0   1.6   0.7   1.2
2026  -0.8   0.6  -1.0  -1.1  -0.3-999.9-999.9-999.9-999.9-999.9-999.9-999.9
2027-999.9-999.9-999.9-999.9-999.9-999.9-999.9-999.9-999.9-999.9-999.9-999.9`;

describe("parseMonthlyGrid", () => {
  it("drops header lines and -999.9 sentinels, keeps valid months in date order", () => {
    const series = parseMonthlyGrid(SAMPLE);
    // 12 (2024) + 12 (2025) + 5 valid (2026 Jan–May) + 0 (2027) = 29.
    expect(series).toHaveLength(29);
    expect(series[0]).toEqual({ year: 2024, month: 1, value: 0.6 });
    // Latest valid is 2026 May = -0.3 (the run-together "-0.3-999.9" must split).
    const latest = series[series.length - 1];
    expect(latest).toEqual({ year: 2026, month: 5, value: -0.3 });
  });

  it("splits run-together negative cells correctly", () => {
    const series = parseMonthlyGrid("2026  -0.9-999.9-999.9");
    expect(series).toEqual([{ year: 2026, month: 1, value: -0.9 }]);
  });

  it("returns empty for header-only / non-data input", () => {
    expect(parseMonthlyGrid("YEAR   JAN   FEB\n\n  some title")).toEqual([]);
  });
});

describe("gridTrend", () => {
  it("flat within dead-band, directional outside", () => {
    expect(gridTrend(-0.9, -0.6, 0.2)).toBe("down"); // SOI sliding negative
    expect(gridTrend(-0.3, -1.1, 0.2)).toBe("up"); // trades recovering
    expect(gridTrend(-0.9, -1.0, 0.2)).toBe("flat"); // within 0.2
    expect(gridTrend(-0.9, null, 0.2)).toBe("flat"); // no prior month
  });
});
