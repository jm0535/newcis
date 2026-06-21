/**
 * Open-Meteo — keyless rainfall + temperature anomaly backstop.
 *
 * Why this exists: the primary rainfall source is HDX (CHIRPS-derived) and
 * temperature has no clean PNG feed. Both can be absent for a cycle. Open-Meteo
 * is a fully keyless weather/archive API; we use its historical archive to
 * compute a self-contained anomaly:
 *
 *   - RAINFALL_ANOM = (recent 30-day precip − same-window 8-yr mean) / mean × 100
 *   - TEMP_ANOM     =  recent 30-day mean Tmax − same-window 8-yr mean
 *
 * These share the SAME indicator keys + threshold bands as the primary sources,
 * so they drop straight into the existing gauges and risk engine. The
 * orchestrator only PROMOTES these when the primary source failed — they are a
 * resilience fallback, never a double-count. Provenance stays LIVE (it is a real
 * pull); the caption names Open-Meteo so the provenance trail is explicit.
 *
 * Per-province points reuse the agricultural-centre coordinates from
 * nasa-power-soil.ts so all per-province climate signals describe the same place.
 */
import type { Indicator, SectorRisk } from "../../src/lib/types";
import { FOCUS_PROVINCES } from "../../src/lib/focus-provinces";

const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";

// Per-province interior points come from the canonical focus-province list, so
// the climate signals always describe exactly the provinces the dashboard shows.
const POINTS: { code: string; name: string; lon: number; lat: number }[] =
  FOCUS_PROVINCES.map(({ code, name, lon, lat }) => ({ code, name, lon, lat }));

const NORMAL_YEARS = 8;

interface DailyBlock {
  precipitation_sum: (number | null)[];
  temperature_2m_max: (number | null)[];
  wind_speed_10m_max: (number | null)[];
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftYears(d: Date, years: number): Date {
  const out = new Date(d);
  out.setUTCFullYear(out.getUTCFullYear() - years);
  return out;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, retries = 3): Promise<DailyBlock> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (res.ok) {
      const body = (await res.json()) as { daily: DailyBlock };
      return body.daily;
    }

    const status = res.status;
    const isRetryable = status === 429 || status === 502 || status === 503 || status === 504;
    const text = await res.text();
    if (!isRetryable || attempt === retries) {
      throw new Error(`Open-Meteo: HTTP ${status} ${text}`);
    }
    await sleep(400 * attempt);
  }
  throw new Error("Open-Meteo: retry loop exited unexpectedly");
}

async function fetchWindow(lon: number, lat: number, start: Date, end: Date): Promise<DailyBlock> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: isoDate(start),
    end_date: isoDate(end),
    daily: "precipitation_sum,temperature_2m_max,wind_speed_10m_max",
    timezone: "UTC",
  });
  return fetchWithRetry(`${ARCHIVE}?${params}`);
}

function sum(xs: (number | null)[]): number {
  return xs.reduce<number>((s, v) => s + (v ?? 0), 0);
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;
}

// Build an Open-Meteo LIVE indicator. All four Open-Meteo indicators share the
// same source/cadence/provenance/timestamp/trend; only key/label/unit/value vary.
function buildIndicator(
  key: string,
  label: string,
  unit: string,
  value: number,
  observedAt: string,
): Indicator {
  return {
    key,
    label,
    unit,
    source: "Open-Meteo archive (ERA5-derived)",
    update_frequency: "daily",
    provenance: "LIVE",
    value,
    observed_at: observedAt,
    trend: "flat",
  };
}

// Storm-day cutoff: a day counts as a "storm day" when any focus-province
// daily-max 10 m wind reaches this speed. 10.8 m/s = Beaufort 6 ("strong
// breeze"). A single explainable absolute threshold; the authoritative value
// lives in risk_thresholds.json (WIND_STORM_DAY_MS) and is passed in by the
// orchestrator — this constant is the fallback default for tests and direct use.
export const STORM_DAY_MS = 10.8;

// Anomaly as a percentage of the long-term normal, rounded to one decimal.
// Guards divide-by-zero (a zero normal — e.g. a desert window — yields 0).
export function anomalyPct(recent: number, normal: number): number {
  if (normal <= 0) return 0;
  return Math.round(((recent - normal) / normal) * 1000) / 10;
}

// Count days in the recent window where AT LEAST ONE focus province's daily-max
// wind reached the cutoff. Input is [day][province] of daily-max wind (m/s);
// nulls (missing) are treated as below-cutoff.
export function countStormDays(
  perDayMaxByProvince: (number | null)[][],
  cutoff: number,
): number {
  return perDayMaxByProvince.filter((day) =>
    day.some((w) => w !== null && w >= cutoff),
  ).length;
}

interface ProvinceAnomaly {
  code: string;
  rainfall_anom_pct: number; // 30-day, feeds the RAINFALL_ANOM backstop
  temp_anom_c: number; // 30-day, feeds TEMP_ANOM
  rain7_anom_pct: number; // 7-day, feeds RAINFALL_DAILY
  wind7_anom_pct: number; // 7-day mean daily-max wind, feeds WIND_ANOM
  windDailyMax: (number | null)[]; // recent 7 daily-max winds, for storm-day counting
}

async function fetchProvince(p: (typeof POINTS)[number]): Promise<ProvinceAnomaly> {
  const now = new Date();
  // Recent windows end 5 days back (the archive has a short lag).
  const recEnd = new Date(now.getTime() - 5 * 24 * 3600 * 1000);
  const recStart30 = new Date(recEnd.getTime() - 30 * 24 * 3600 * 1000);
  const recStart7 = new Date(recEnd.getTime() - 7 * 24 * 3600 * 1000);

  // 30-day window (existing RAINFALL_ANOM backstop + TEMP_ANOM).
  const recent30 = await fetchWindow(p.lon, p.lat, recStart30, recEnd);
  const recentPrecip30 = sum(recent30.precipitation_sum);
  const recentTmax = mean(recent30.temperature_2m_max.filter((v): v is number => v !== null));

  // 7-day window (new daily rainfall + wind).
  const recent7 = await fetchWindow(p.lon, p.lat, recStart7, recEnd);
  const recentPrecip7 = sum(recent7.precipitation_sum);
  const recentWind7 = mean(recent7.wind_speed_10m_max.filter((v): v is number => v !== null));

  const normPrecip30: number[] = [];
  const normPrecip7: number[] = [];
  const normWind7: number[] = [];
  const normTmax: number[] = [];
  for (let y = 1; y <= NORMAL_YEARS; y++) {
    const block30 = await fetchWindow(p.lon, p.lat, shiftYears(recStart30, y), shiftYears(recEnd, y));
    normPrecip30.push(sum(block30.precipitation_sum));
    const t = block30.temperature_2m_max.filter((v): v is number => v !== null);
    if (t.length) normTmax.push(mean(t));

    const block7 = await fetchWindow(p.lon, p.lat, shiftYears(recStart7, y), shiftYears(recEnd, y));
    normPrecip7.push(sum(block7.precipitation_sum));
    const w = block7.wind_speed_10m_max.filter((v): v is number => v !== null);
    if (w.length) normWind7.push(mean(w));
    await sleep(250);
  }

  return {
    code: p.code,
    rainfall_anom_pct: anomalyPct(recentPrecip30, mean(normPrecip30)),
    temp_anom_c: Math.round((recentTmax - mean(normTmax)) * 10) / 10,
    rain7_anom_pct: anomalyPct(recentPrecip7, mean(normPrecip7)),
    wind7_anom_pct: anomalyPct(recentWind7, mean(normWind7)),
    windDailyMax: recent7.wind_speed_10m_max.slice(0, 7),
  };
}

export interface OpenMeteoResult {
  rainfall_indicator: Indicator;
  temp_indicator: Indicator;
  rainfall_daily_indicator: Indicator;
  wind_anom_indicator: Indicator;
  /** Days in the recent 7-day window with a storm-force gust in any province. */
  storm_days: number;
  /** Water/Food/Public-Health sector rows derived from per-province rainfall. */
  sector_rows: SectorRisk[];
  note: string;
}

export async function fetchOpenMeteo(focusCodes: string[]): Promise<OpenMeteoResult> {
  const points = POINTS.filter((p) => focusCodes.includes(p.code));
  const results: ProvinceAnomaly[] = [];
  for (const point of points) {
    results.push(await fetchProvince(point));
  }

  const meanRain = Math.round((results.reduce((s, r) => s + r.rainfall_anom_pct, 0) / results.length) * 10) / 10;
  const meanTemp = Math.round((results.reduce((s, r) => s + r.temp_anom_c, 0) / results.length) * 10) / 10;
  const observedAt = new Date().toISOString();

  const rainfall_indicator = buildIndicator(
    "RAINFALL_ANOM",
    "Rainfall anomaly (focus provinces, 30-day)",
    "% of 8-yr normal",
    meanRain,
    observedAt,
  );

  const temp_indicator = buildIndicator(
    "TEMP_ANOM",
    "Temperature anomaly (focus provinces, 30-day Tmax)",
    "°C vs 8-yr normal",
    meanTemp,
    observedAt,
  );

  const meanRain7 = Math.round((results.reduce((s, r) => s + r.rain7_anom_pct, 0) / results.length) * 10) / 10;
  const meanWind7 = Math.round((results.reduce((s, r) => s + r.wind7_anom_pct, 0) / results.length) * 10) / 10;
  // results is [province][day]; countStormDays wants [day][province]. Transpose
  // so a "storm day" counts ACROSS provinces, capping the result at 7.
  const dayCount = Math.max(0, ...results.map((r) => r.windDailyMax.length));
  const byDay: (number | null)[][] = Array.from({ length: dayCount }, (_, d) =>
    results.map((r) => r.windDailyMax[d] ?? null),
  );
  const stormDays = countStormDays(byDay, STORM_DAY_MS);

  const rainfall_daily_indicator = buildIndicator(
    "RAINFALL_DAILY",
    `Rainfall (7-day, daily · ${results.length} of ${POINTS.length} provinces)`,
    "% of 8-yr normal",
    meanRain7,
    observedAt,
  );

  const wind_anom_indicator = buildIndicator(
    "WIND_ANOM",
    `Wind anomaly (7-day, daily · ${stormDays} storm-day${stormDays === 1 ? "" : "s"} / 7)`,
    "% of 8-yr normal",
    meanWind7,
    observedAt,
  );

  // Per-province Water Security rows from the rainfall anomaly. Bands mirror
  // RAINFALL_ANOM in risk_thresholds.json (inverted: more negative = worse).
  function classifyRain(pct: number): SectorRisk["level"] {
    if (pct <= -60) return "critical";
    if (pct <= -40) return "high";
    if (pct <= -20) return "med";
    return "low";
  }

  const sector_rows: SectorRisk[] = results.map((r) => ({
    province_code: r.code,
    sector: "Water Security",
    level: classifyRain(r.rainfall_anom_pct),
    score: Math.min(1, Math.max(0, -r.rainfall_anom_pct / 60)),
    trend: "flat",
    provenance: "LIVE",
    as_of: observedAt,
    data_source: `Open-Meteo · rainfall ${r.rainfall_anom_pct}% of normal`,
  }));

  return {
    rainfall_indicator,
    temp_indicator,
    rainfall_daily_indicator,
    wind_anom_indicator,
    storm_days: stormDays,
    sector_rows,
    note: `Open-Meteo: rainfall ${meanRain}% of normal, temp +${meanTemp}°C, 7d rain ${meanRain7}% / wind ${meanWind7}% / ${stormDays} storm-days (mean of ${results.length} provinces)`,
  };
}
