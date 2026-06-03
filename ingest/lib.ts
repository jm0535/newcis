/**
 * Ingestion library. Pure orchestration logic, no process.exit, no top-level side effects.
 *
 * Two callers:
 *   - ingest/run.ts        (CLI via `pnpm ingest`, used by local cron)
 *   - /api/ingest route    (Refresh button on the dashboard)
 *
 * Writes the same /data JSON files in both cases. Returns the LastRun record so the
 * caller can decide what to do with it (log to stdout / return as JSON response).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fetchOni } from "./sources/oni";
import { fetchHdxFoodSecurity } from "./sources/hdx-food-security";
import { fetchHdxRainfall } from "./sources/hdx-rainfall";
import type {
  Indicator,
  HistoricalReading,
  SectorRisk,
  LastRun,
  NationalStatus,
} from "../src/lib/types";

const DATA = path.join(process.cwd(), "data");

// Focus province HDX admin1 p-codes (Enga, Western Highlands, Southern Highlands, Gulf).
const FOCUS_CODES = ["PG08", "PG09", "PG07", "PG02"];

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA, file), "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.writeFile(path.join(DATA, file), JSON.stringify(value, null, 2) + "\n");
}

interface SourceResult<T> {
  ok: boolean;
  value: T | null;
  error?: string;
  ms: number;
}

async function run<T>(name: string, fn: () => Promise<T>): Promise<SourceResult<T>> {
  const t0 = Date.now();
  try {
    const value = await fn();
    return { ok: true, value, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, value: null, error: String(e), ms: Date.now() - t0 };
  }
}

function computeTrend(
  key: string,
  newValue: number,
  history: HistoricalReading[],
): Indicator["trend"] {
  const prior = history
    .filter((h) => h.key === key)
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
  if (!prior) return "flat";
  const delta = newValue - prior.value;
  const threshold = Math.max(0.05, Math.abs(prior.value) * 0.05);
  if (Math.abs(delta) < threshold) return "flat";
  return delta > 0 ? "up" : "down";
}

export async function runIngest(): Promise<LastRun> {
  const startedAt = new Date().toISOString();

  const appId = process.env.HDX_APP_ID;

  const oniRes = await run("noaa_oni", fetchOni);
  const rainfallRes = appId
    ? await run("hdx_rainfall", () => fetchHdxRainfall(appId, FOCUS_CODES))
    : { ok: false, value: null, error: "no HDX_APP_ID", ms: 0 };
  const foodRes = appId
    ? await run("hdx_food_security", () => fetchHdxFoodSecurity(appId, FOCUS_CODES))
    : { ok: false, value: null, error: "no HDX_APP_ID", ms: 0 };

  const history = await readJson<HistoricalReading[]>("readings_history.json", []);
  const existingSectorRisk = await readJson<SectorRisk[]>("sector_risk.json", []);

  const liveIndicators: Indicator[] = [];

  if (oniRes.ok && oniRes.value) {
    const ind = oniRes.value.indicator;
    ind.trend = computeTrend(ind.key, ind.value ?? 0, history);
    liveIndicators.push(ind);
    if (ind.value !== null) {
      history.push({ key: ind.key, value: ind.value, observed_at: ind.observed_at });
    }
  }

  if (rainfallRes.ok && rainfallRes.value) {
    const ind = rainfallRes.value.indicator;
    if (ind.value !== null) {
      ind.trend = computeTrend(ind.key, ind.value, history);
      liveIndicators.push(ind);
      history.push({ key: ind.key, value: ind.value, observed_at: ind.observed_at });
    }
  }

  const seen = new Set<string>();
  const dedupedHistory = [...history]
    .reverse()
    .filter((h) => {
      const k = `${h.key}:${h.observed_at}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .reverse();

  const liveSectorRows: SectorRisk[] = [];
  if (rainfallRes.ok && rainfallRes.value) liveSectorRows.push(...rainfallRes.value.sector_rows);
  if (foodRes.ok && foodRes.value) liveSectorRows.push(...foodRes.value.rows);

  const liveKey = (r: SectorRisk) => `${r.province_code}::${r.sector}`;
  const liveKeys = new Set(liveSectorRows.map(liveKey));
  const preservedDemo = existingSectorRisk.filter(
    (r) => r.provenance === "DEMO" && !liveKeys.has(liveKey(r)),
  );
  const mergedSectorRisk = [...liveSectorRows, ...preservedDemo];

  const focusRowsLive = liveSectorRows.filter((r) => FOCUS_CODES.includes(r.province_code));
  const highRiskProvinces = new Set(
    focusRowsLive.filter((r) => r.level === "high" || r.level === "critical").map((r) => r.province_code),
  );
  const overallLevel: NationalStatus["alert_level"] =
    oniRes.ok && oniRes.value && Math.abs(oniRes.value.indicator.value ?? 0) > 1.5
      ? "BLACK"
      : oniRes.ok && oniRes.value && Math.abs(oniRes.value.indicator.value ?? 0) > 1.0
        ? "RED"
        : oniRes.ok && oniRes.value && Math.abs(oniRes.value.indicator.value ?? 0) > 0.5
          ? "AMBER"
          : "GREEN";

  const nationalStatus: NationalStatus = {
    enso_phase:
      oniRes.ok && oniRes.value
        ? (oniRes.value.indicator.value ?? 0) > 0.5
          ? (oniRes.value.indicator.value ?? 0) > 1.0
            ? "el_nino_alert"
            : "el_nino_watch"
          : (oniRes.value.indicator.value ?? 0) < -0.5
            ? (oniRes.value.indicator.value ?? 0) < -1.0
              ? "la_nina_alert"
              : "la_nina_watch"
            : "neutral"
        : "neutral",
    alert_level: overallLevel,
    national_risk_rating: highRiskProvinces.size >= 2 ? "high" : highRiskProvinces.size >= 1 ? "med" : "low",
    affected_population_est: 0,
    high_risk_province_count: highRiskProvinces.size,
    forecast_period: "Next 3 months",
    updated_at: new Date().toISOString(),
  };

  await writeJson("indicators.json", liveIndicators);
  await writeJson("readings_history.json", dedupedHistory);
  await writeJson("sector_risk.json", mergedSectorRisk);
  await writeJson("national_status.json", nationalStatus);

  const lastRun: LastRun = {
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    status: [oniRes, rainfallRes, foodRes].every((r) => r.ok)
      ? "ok"
      : [oniRes, rainfallRes, foodRes].some((r) => r.ok)
        ? "partial"
        : "failed",
    sources_ok: {
      noaa_oni: oniRes.ok,
      hdx_rainfall: rainfallRes.ok,
      hdx_food_security: foodRes.ok,
    },
    notes: [
      oniRes.ok ? `ONI ${oniRes.value?.indicator.value} (${oniRes.ms}ms)` : `ONI failed: ${oniRes.error}`,
      rainfallRes.ok
        ? `Rainfall mean anom ${rainfallRes.value?.indicator.value}% (${rainfallRes.value?.raw_count} raw rows, ${rainfallRes.ms}ms)`
        : `Rainfall failed: ${rainfallRes.error}`,
      foodRes.ok ? `Food security: ${foodRes.value?.note}` : `Food security failed: ${foodRes.error}`,
    ].join(" | "),
  };
  await writeJson("last_run.json", lastRun);

  return lastRun;
}
