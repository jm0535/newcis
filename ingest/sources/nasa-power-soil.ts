/**
 * NASA POWER — root-zone soil wetness (GWETROOT) for the four focus provinces.
 *
 * GWETROOT is a 0..1 fraction derived from NASA's MERRA-2 / SMAP assimilation
 * (1 = saturation, 0 = wilting point). It is the operationally-available
 * SMAP-equivalent metric: NASA POWER serves it as a JSON point query with
 * no auth, no API key, and no raster extraction. Perfect for the PoC; the
 * production system can substitute the full SMAP L4 raster later.
 *
 * We compute a percentile-of-climatology by ranking the latest month against
 * the prior 12 months of the same series, then map percentile → SOIL_MOISTURE
 * indicator + per-province SectorRisk rows for Water Security.
 *
 * Why a percentile, not raw GWETROOT: the SOIL_MOISTURE threshold bands in
 * risk_thresholds.json are already specified in percentile units (matches how
 * NASA Earthdata's SPoRT-LIS product is presented). One band file, both sources.
 */
import type { Indicator, SectorRisk } from "../../src/lib/types";
import { FOCUS_PROVINCES } from "../../src/lib/focus-provinces";

const POWER_BASE = "https://power.larc.nasa.gov/api/temporal/monthly/point";

// One representative interior point per focus province — sourced from the
// canonical focus-province list (src/lib/focus-provinces.ts), so a province
// added there is automatically pulled here with no drift.
const POINTS: { code: string; name: string; lon: number; lat: number }[] =
  FOCUS_PROVINCES.map(({ code, name, lon, lat }) => ({ code, name, lon, lat }));

interface PowerResponse {
  properties: { parameter: { GWETROOT: Record<string, number> } };
}

interface ProvinceWetness {
  code: string;
  name: string;
  latestKey: string;
  latestValue: number;
  percentile: number; // 0..100
  history: { key: string; value: number }[];
}

// English ordinal suffix (1st, 2nd, 3rd, 33rd, 42nd…). 11/12/13 are the -th
// exceptions. Used for the percentile label so it never reads "33th".
function ordinal(n: number): string {
  const r100 = n % 100;
  if (r100 >= 11 && r100 <= 13) return `${n}th`;
  const r10 = n % 10;
  const suffix = r10 === 1 ? "st" : r10 === 2 ? "nd" : r10 === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}

async function fetchPoint(code: string, name: string, lon: number, lat: number): Promise<ProvinceWetness> {
  // NASA POWER monthly product publishes through the end of the previous full
  // calendar year. Asking for the current year returns HTTP 422.
  const now = new Date();
  const endYear = now.getUTCFullYear() - 1;
  const startYear = endYear - 2;
  const url = `${POWER_BASE}?parameters=GWETROOT&community=AG&longitude=${lon}&latitude=${lat}&start=${startYear}&end=${endYear}&format=JSON`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`NASA POWER ${code}: HTTP ${res.status}`);
  const body = (await res.json()) as PowerResponse;
  const series = body.properties?.parameter?.GWETROOT ?? {};
  // Drop the year-aggregate keys (YYYY13). Keep monthly only, sorted by date.
  const monthly = Object.entries(series)
    .filter(([k, v]) => /^\d{6}$/.test(k) && !k.endsWith("13") && Number.isFinite(v) && v >= 0)
    .sort(([a], [b]) => a.localeCompare(b));
  if (monthly.length === 0) throw new Error(`NASA POWER ${code}: empty series`);
  const [latestKey, latestValue] = monthly[monthly.length - 1];
  // Percentile = rank of latest among the prior 12 months (climatology proxy).
  const window = monthly.slice(Math.max(0, monthly.length - 13), monthly.length - 1).map(([, v]) => v);
  const below = window.filter((v) => v < latestValue).length;
  const percentile = window.length ? Math.round((below / window.length) * 100) : 50;
  return {
    code,
    name,
    latestKey,
    latestValue,
    percentile,
    history: monthly.map(([key, value]) => ({ key, value })),
  };
}

/**
 * Median of a numeric list. Used to summarise per-province percentiles into one
 * national figure. The median (not the mean) is the correct summary statistic
 * here: a percentile is a bounded ordinal measure, and averaging percentiles
 * across provinces distorts under skew (one saturated province would drag the
 * mean up even if most provinces are dry). The median is the typical province.
 */
function median(values: number[]): number {
  if (values.length === 0) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function classifyPercentile(p: number): SectorRisk["level"] {
  // Aligned with risk_thresholds.json SOIL_MOISTURE bands (inverted).
  if (p <= 10) return "critical";
  if (p <= 20) return "high";
  if (p <= 40) return "med";
  return "low";
}

function isoFromYYYYMM(yyyymm: string): string {
  return `${yyyymm.slice(0, 4)}-${yyyymm.slice(4, 6)}-01`;
}

export interface NasaPowerSoilResult {
  indicator: Indicator;
  sector_rows: SectorRisk[];
  per_province: ProvinceWetness[];
}

export async function fetchNasaPowerSoil(): Promise<NasaPowerSoilResult> {
  const results = await Promise.all(POINTS.map((p) => fetchPoint(p.code, p.name, p.lon, p.lat)));

  // National indicator = MEDIAN focus-province percentile (the typical province).
  // Percentiles are bounded ordinal measures, so the median is the statistically
  // sound summary; the per-province cells carry the granular signal for the gauge.
  const medianPercentile = Math.round(median(results.map((r) => r.percentile)));
  const observedAt = isoFromYYYYMM(results[0].latestKey);

  const indicator: Indicator = {
    key: "SOIL_MOISTURE",
    label: `Root-zone soil moisture (median of ${results.length} of ${POINTS.length} provinces reporting)`,
    unit: "percentile vs 12-mo climatology",
    source: "NASA POWER · MERRA-2 GWETROOT",
    update_frequency: "monthly",
    provenance: "LIVE",
    value: medianPercentile,
    observed_at: observedAt,
    trend: "flat", // computed by the orchestrator against readings_history
  };

  const sector_rows: SectorRisk[] = results.map((r) => ({
    province_code: r.code,
    sector: "Water Security",
    level: classifyPercentile(r.percentile),
    score: 1 - r.percentile / 100,
    trend: "flat",
    provenance: "LIVE",
    as_of: new Date().toISOString(),
    data_source: `NASA POWER · GWETROOT ${ordinal(r.percentile)} pctile`,
  }));

  return { indicator, sector_rows, per_province: results };
}
