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
    daily: "precipitation_sum,temperature_2m_max",
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

interface ProvinceAnomaly {
  code: string;
  rainfall_anom_pct: number;
  temp_anom_c: number;
}

async function fetchProvince(p: (typeof POINTS)[number]): Promise<ProvinceAnomaly> {
  const now = new Date();
  // Recent 30-day window, ending 5 days back (archive has a short lag).
  const recEnd = new Date(now.getTime() - 5 * 24 * 3600 * 1000);
  const recStart = new Date(recEnd.getTime() - 30 * 24 * 3600 * 1000);

  const recent = await fetchWindow(p.lon, p.lat, recStart, recEnd);
  const recentPrecip = sum(recent.precipitation_sum);
  const recentTmax = mean(recent.temperature_2m_max.filter((v): v is number => v !== null));

  const normPrecip: number[] = [];
  const normTmax: number[] = [];
  for (let y = 1; y <= NORMAL_YEARS; y++) {
    const block = await fetchWindow(p.lon, p.lat, shiftYears(recStart, y), shiftYears(recEnd, y));
    normPrecip.push(sum(block.precipitation_sum));
    const t = block.temperature_2m_max.filter((v): v is number => v !== null);
    if (t.length) normTmax.push(mean(t));
    await sleep(250);
  }

  const normalPrecip = mean(normPrecip);
  const normalTmax = mean(normTmax);

  return {
    code: p.code,
    rainfall_anom_pct: normalPrecip > 0 ? Math.round(((recentPrecip - normalPrecip) / normalPrecip) * 1000) / 10 : 0,
    temp_anom_c: Math.round((recentTmax - normalTmax) * 10) / 10,
  };
}

export interface OpenMeteoResult {
  rainfall_indicator: Indicator;
  temp_indicator: Indicator;
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

  const rainfall_indicator: Indicator = {
    key: "RAINFALL_ANOM",
    label: "Rainfall anomaly (focus provinces, 30-day)",
    unit: "% of 8-yr normal",
    source: "Open-Meteo archive (ERA5-derived)",
    update_frequency: "daily",
    provenance: "LIVE",
    value: meanRain,
    observed_at: observedAt,
    trend: "flat",
  };

  const temp_indicator: Indicator = {
    key: "TEMP_ANOM",
    label: "Temperature anomaly (focus provinces, 30-day Tmax)",
    unit: "°C vs 8-yr normal",
    source: "Open-Meteo archive (ERA5-derived)",
    update_frequency: "daily",
    provenance: "LIVE",
    value: meanTemp,
    observed_at: observedAt,
    trend: "flat",
  };

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
    sector_rows,
    note: `Open-Meteo: rainfall ${meanRain}% of normal, temp +${meanTemp}°C (mean of ${results.length} provinces)`,
  };
}
