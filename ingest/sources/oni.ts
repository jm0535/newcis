/**
 * NOAA Relative Oceanic Niño Index (RONI) — climate credibility anchor.
 *
 * Source: NOAA CPC. As of 1 February 2026, NOAA replaced the traditional ONI with the
 * RONI as its operational ENSO monitoring standard. RONI is the Niño-3.4 SST anomaly
 * MINUS the all-tropics mean SST anomaly, which removes the broad global-warming
 * background and isolates the genuine Pacific ENSO signal. El Niño is still declared when
 * RONI exceeds +0.5 °C for five consecutive overlapping 3-month seasons — same bands as
 * the old ONI, so our risk_thresholds entry is unchanged; only the feed and labelling move.
 *
 *   https://www.cpc.ncep.noaa.gov/data/indices/RONI.ascii.txt
 *
 * Format (note: 3 columns, no TOTAL column the old oni.ascii.txt carried):
 *   SEAS YR  ANOM
 *   DJF 1950 -1.47
 *   ...
 * The last row with a numeric ANOM is the latest 3-month value; the row before it is the
 * comparator we use to compute trend.
 *
 * We keep the indicator key "ONI" — it is the internal metric slot threaded through the
 * thresholds file, readings history and risk engine. The value now comes from the RONI
 * feed; the label/unit/source say so. This is the same gauge, fed by NOAA's current
 * standard, not a fabricated relabel.
 */
import type { Indicator } from "../../src/lib/types";

const RONI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/RONI.ascii.txt";

const SEASON_MIDDLE_MONTH: Record<string, number> = {
  DJF: 1, JFM: 2, FMA: 3, MAM: 4, AMJ: 5, MJJ: 6,
  JJA: 7, JAS: 8, ASO: 9, SON: 10, OND: 11, NDJ: 12,
};

function parseRows(text: string): Array<{ seas: string; yr: number; anom: number }> {
  const rows: Array<{ seas: string; yr: number; anom: number }> = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("SEAS")) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 3) continue;
    const seas = parts[0];
    const yr = Number(parts[1]);
    const anom = Number(parts[2]); // RONI: SEAS YR ANOM (no TOTAL column)
    if (!SEASON_MIDDLE_MONTH[seas] || !Number.isFinite(yr) || !Number.isFinite(anom)) continue;
    rows.push({ seas, yr, anom });
  }
  return rows;
}

function observedAt(seas: string, yr: number): string {
  const month = SEASON_MIDDLE_MONTH[seas];
  return new Date(Date.UTC(yr, month - 1, 15)).toISOString().slice(0, 10);
}

export interface OniResult {
  indicator: Indicator;
  previous_value: number | null;
}

export async function fetchOni(): Promise<OniResult> {
  const res = await fetch(RONI_URL, { headers: { "user-agent": "newcis-ingest/0.1" } });
  if (!res.ok) throw new Error(`RONI fetch failed: HTTP ${res.status}`);
  const text = await res.text();
  const rows = parseRows(text);
  if (rows.length < 2) throw new Error("ONI: not enough rows parsed");

  const latest = rows[rows.length - 1];
  const previous = rows[rows.length - 2];

  const trend: Indicator["trend"] =
    Math.abs(latest.anom - previous.anom) < 0.05
      ? "flat"
      : latest.anom > previous.anom
        ? "up"
        : "down";

  return {
    indicator: {
      key: "ONI",
      label: "Relative Oceanic Niño Index (RONI)",
      unit: "°C relative SST anomaly (Niño 3.4 − tropics, 3-mo mean)",
      source: "NOAA CPC · RONI (relative ONI, operational since Feb 2026)",
      update_frequency: "monthly",
      provenance: "LIVE",
      value: latest.anom,
      observed_at: observedAt(latest.seas, latest.yr),
      trend,
    },
    previous_value: previous.anom,
  };
}

// CLI smoke test: `pnpm tsx ingest/sources/oni.ts`
if (process.argv[1] && process.argv[1].endsWith("oni.ts")) {
  fetchOni().then(
    (r) => console.log(JSON.stringify(r, null, 2)),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
