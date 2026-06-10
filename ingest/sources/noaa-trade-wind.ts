/**
 * NOAA CPC 850 mb West-Pacific Trade-Wind Index (wpac850) — the wind precursor.
 *
 * This is the zonal (east–west) wind anomaly at 850 mb over the western
 * equatorial Pacific (135°E–180°, 5°N–5°S). The trade winds normally blow east
 * → west; a NEGATIVE anomaly means they have WEAKENED or reversed (westerly
 * wind bursts), which pushes warm water eastward and is a classic *leading*
 * El Niño trigger — it precedes the surface SST signal by weeks to months.
 * A POSITIVE anomaly (strengthened trades) leans La Niña.
 *
 *   https://www.cpc.ncep.noaa.gov/data/indices/wpac850
 *
 * Header: "850 MB TRADE WIND INDEX(135E-180W)5N 5S WEST PACIFIC".
 * Same shared CPC monthly grid (YEAR JAN..DEC, -999.9 = unobserved).
 *
 * Provenance LIVE; this is a national ENSO-precursor gauge, not a per-province
 * sectoral driver, so it emits an indicator only (no SectorRisk rows).
 */
import type { Indicator } from "../../src/lib/types";
import { fetchMonthlyGrid, gridTrend } from "./noaa-cpc-grid";

const WPAC850_URL = "https://www.cpc.ncep.noaa.gov/data/indices/wpac850";

export interface NoaaTradeWindResult {
  indicator: Indicator;
  previous_value: number | null;
}

export async function fetchNoaaTradeWind(): Promise<NoaaTradeWindResult> {
  const point = await fetchMonthlyGrid(WPAC850_URL, "Trade wind (wpac850)");
  return {
    indicator: {
      key: "TRADE_WIND_ANOM",
      label: "West-Pacific trade-wind anomaly (850 mb)",
      unit: "m/s zonal anomaly (135°E–180°, 5°N–5°S)",
      source: "NOAA CPC",
      update_frequency: "monthly",
      provenance: "LIVE",
      value: point.value,
      observed_at: point.observed_at,
      trend: gridTrend(point.value, point.previous, 0.2),
    },
    previous_value: point.previous,
  };
}

// CLI smoke test: `pnpm tsx ingest/sources/noaa-trade-wind.ts`
if (process.argv[1] && process.argv[1].endsWith("noaa-trade-wind.ts")) {
  fetchNoaaTradeWind().then(
    (r) => console.log(JSON.stringify(r, null, 2)),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
