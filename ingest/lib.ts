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
  RiskThreshold,
  Sector,
} from "../src/lib/types";
import { rollUpNational, scoreSector, computeTrend as engineTrend } from "../src/lib/risk-engine";

const SECTORS: Sector[] = [
  "Food Security",
  "Water Security",
  "Public Health",
  "Economic Stability",
  "Infrastructure",
  "Energy Security",
  "Social Stability",
];

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

const computeTrend = engineTrend;

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

  // 4. Source-derived sector rows (province-specific datapoints from rainfall + food security).
  const upstreamRows: SectorRisk[] = [];
  if (rainfallRes.ok && rainfallRes.value) upstreamRows.push(...rainfallRes.value.sector_rows);
  if (foodRes.ok && foodRes.value) upstreamRows.push(...foodRes.value.rows);

  // 5. Risk engine: produce a SectorRisk cell for every (focus province × sector),
  //    combining national indicators with any matching upstream row.
  const thresholds = await readJson<RiskThreshold[]>("risk_thresholds.json", []);
  const upstreamByKey = new Map(upstreamRows.map((r) => [`${r.province_code}::${r.sector}`, r]));
  const engineRows: SectorRisk[] = [];
  for (const provinceCode of FOCUS_CODES) {
    for (const sector of SECTORS) {
      engineRows.push(
        scoreSector(provinceCode, sector, {
          indicators: liveIndicators,
          thresholds,
          provinceSectorRow: upstreamByKey.get(`${provinceCode}::${sector}`),
        }),
      );
    }
  }

  // 6. Merge: engine rows for focus provinces overlay everything; preserve unrelated
  //    DEMO rows (e.g. non-focus provinces) untouched.
  const engineKeys = new Set(engineRows.map((r) => `${r.province_code}::${r.sector}`));
  const preservedDemo = existingSectorRisk.filter(
    (r) => r.provenance === "DEMO" && !engineKeys.has(`${r.province_code}::${r.sector}`),
  );
  const mergedSectorRisk = [...engineRows, ...preservedDemo];

  // 7. National rollup via the engine.
  const nationalStatus = rollUpNational(
    liveIndicators,
    thresholds,
    mergedSectorRisk,
    FOCUS_CODES,
  );

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
