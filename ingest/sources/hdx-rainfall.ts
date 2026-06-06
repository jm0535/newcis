/**
 * HDX HAPI — climate/rainfall (CHIRPS-derived, dekadal, by PNG admin1).
 * Returns rainfall anomaly % of long-term average for each focus province.
 *
 *   GET /api/v2/climate/rainfall?location_code=PNG&aggregation_period=dekad
 *
 * The most recent dekad per admin1_code is what we surface. `rainfall_anomaly_pct` is
 * already a percentage (e.g. 87 = 87% of normal, i.e. 13% below). The risk engine reads
 * this as the "RAINFALL_ANOM" indicator via thresholds in risk_thresholds.json (which
 * are configured in %-of-normal deficits, e.g. -40% AMBER).
 */
import type { SectorRisk, Indicator } from "../../src/lib/types";
import { hdxFetch } from "./hdx-client";

const BASE = "https://hapi.humdata.org/api/v2/climate/rainfall";

interface RainRow {
  admin1_code: string;
  admin1_name: string;
  rainfall: number;
  rainfall_long_term_average: number;
  rainfall_anomaly_pct: number;
  reference_period_start: string;
  reference_period_end: string;
}

export interface RainfallResult {
  // National aggregate indicator (mean anomaly across focus provinces)
  indicator: Indicator;
  // Per-province sector rows for the rainfall hazard panel (also feeds water security)
  sector_rows: SectorRisk[];
  raw_count: number;
}

export async function fetchHdxRainfall(
  appId: string,
  focusCodes: string[],
): Promise<RainfallResult> {
  // HAPI caps limit at 10000. Recent dekads are at the end of the result set; paginate
  // descending and break once we have at least one record per focus admin1.
  const rows: RainRow[] = [];
  let offset = 0;
  const PAGE = 10000;
  for (let i = 0; i < 5; i++) {
    const url = `${BASE}?location_code=PNG&aggregation_period=dekad&output_format=json&limit=${PAGE}&offset=${offset}&app_identifier=${appId}`;
    const res = await hdxFetch(url);
    if (!res.ok) throw new Error(`HDX rainfall: HTTP ${res.status}`);
    const body = (await res.json()) as { data: RainRow[] };
    rows.push(...body.data);
    if (body.data.length < PAGE) break;
    offset += PAGE;
  }
  const body = { data: rows };

  // Latest dekad per admin1_code.
  const latest = new Map<string, RainRow>();
  for (const r of body.data) {
    const prev = latest.get(r.admin1_code);
    if (!prev || r.reference_period_end > prev.reference_period_end) {
      latest.set(r.admin1_code, r);
    }
  }

  // Convert "% of normal" → "% anomaly from normal" (so -40 = 40% deficit).
  // The threshold file is calibrated against this anomaly representation.
  const anomalyOf = (r: RainRow) => r.rainfall_anomaly_pct - 100;

  const focusRows = focusCodes
    .map((c) => latest.get(c))
    .filter((r): r is RainRow => Boolean(r));

  const meanAnom =
    focusRows.length === 0
      ? null
      : focusRows.reduce((s, r) => s + anomalyOf(r), 0) / focusRows.length;

  const mostRecent = [...latest.values()].sort((a, b) =>
    b.reference_period_end.localeCompare(a.reference_period_end),
  )[0];

  const indicator: Indicator = {
    key: "RAINFALL_ANOM",
    label: "Rainfall anomaly (focus provinces, latest dekad)",
    unit: "% deviation from long-term mean",
    source: "HDX HAPI · CHIRPS",
    update_frequency: "dekadal (10-day)",
    provenance: meanAnom === null ? "DEMO" : "LIVE",
    value: meanAnom === null ? null : Number(meanAnom.toFixed(1)),
    observed_at: mostRecent ? mostRecent.reference_period_end.slice(0, 10) : new Date().toISOString().slice(0, 10),
    trend: "flat",
  };

  const asOf = new Date().toISOString();
  const sector_rows: SectorRisk[] = focusRows.map((r) => {
    const a = anomalyOf(r);
    const level: SectorRisk["level"] =
      a <= -60 ? "critical" : a <= -40 ? "high" : a <= -20 ? "med" : "low";
    return {
      province_code: r.admin1_code,
      sector: "Water Security",
      level,
      score: Math.max(0, Math.min(1, -a / 80)),
      trend: "flat",
      provenance: "LIVE",
      as_of: asOf,
      data_source: "HDX HAPI · CHIRPS rainfall",
    };
  });

  return { indicator, sector_rows, raw_count: body.data.length };
}

if (process.argv[1] && process.argv[1].endsWith("hdx-rainfall.ts")) {
  const appId = process.env.HDX_APP_ID;
  if (!appId) throw new Error("HDX_APP_ID env var required");
  const focus = ["PG08", "PG09", "PG07", "PG02"];
  fetchHdxRainfall(appId, focus).then(
    (r) => console.log(JSON.stringify(r, null, 2)),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
