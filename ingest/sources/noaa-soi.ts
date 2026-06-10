/**
 * NOAA CPC Southern Oscillation Index (SOI) — the atmospheric half of ENSO.
 *
 * SOI is the standardized Tahiti−Darwin sea-level-pressure anomaly. Sustained
 * NEGATIVE SOI = weakened Walker circulation = El Niño conditions; sustained
 * POSITIVE = La Niña. It is the canonical *atmospheric* confirmation that pairs
 * with ONI's *oceanic* SST signal — when both point the same way, an event is
 * coupled and far more credible.
 *
 *   https://www.cpc.ncep.noaa.gov/data/indices/soi
 *
 * SCALE NOTE (important): this is NOAA's standardized SOI, range roughly
 * -4..+4, NOT the Australian BoM SOI which is multiplied by 10 (range ~-40..+40).
 * NOAA -1.0 ≈ BoM -10. risk_thresholds.json SOI bands are tuned to THIS NOAA
 * scale (green_max -0.7, amber_max -1.0, red_max -1.5). Do not confuse the two.
 *
 * Format is the shared CPC monthly grid (YEAR JAN..DEC, -999.9 = unobserved).
 */
import type { Indicator } from "../../src/lib/types";
import { fetchMonthlyGrid, gridTrend } from "./noaa-cpc-grid";

const SOI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/soi";

export interface NoaaSoiResult {
  indicator: Indicator;
  previous_value: number | null;
}

export async function fetchNoaaSoi(): Promise<NoaaSoiResult> {
  const point = await fetchMonthlyGrid(SOI_URL, "SOI");
  return {
    indicator: {
      key: "SOI",
      label: "Southern Oscillation Index",
      unit: "standardized Tahiti−Darwin pressure anomaly (NOAA scale)",
      source: "NOAA CPC",
      update_frequency: "monthly",
      provenance: "LIVE",
      value: point.value,
      observed_at: point.observed_at,
      // 0.2 ≈ one-sixth of the watch band (0.7), a sensible dead-band on a
      // ~-4..+4 standardized index.
      trend: gridTrend(point.value, point.previous, 0.2),
    },
    previous_value: point.previous,
  };
}

// CLI smoke test: `pnpm tsx ingest/sources/noaa-soi.ts`
if (process.argv[1] && process.argv[1].endsWith("noaa-soi.ts")) {
  fetchNoaaSoi().then(
    (r) => console.log(JSON.stringify(r, null, 2)),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
