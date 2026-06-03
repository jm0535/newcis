/**
 * Ingestion orchestrator. Run via `pnpm ingest`.
 *
 * 1. Call every source module. Per-source failures are caught and recorded in last_run.json;
 *    a single failed source does NOT abort the run.
 * 2. Merge results into the working JSON files in /data.
 * 3. Append latest readings to readings_history.json (12-month trend store).
 * 4. Write last_run.json with the per-source ok/fail map (data-health badge feed).
 *
 * The risk engine wiring (Phase 3) will plug in after step 2 and overwrite
 * sector_risk.json + national_status.json. For now we write what we have honestly.
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

// Trend helper: compare latest value against the most recent prior reading in history.
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

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`[ingest] start ${startedAt}`);

  const appId = process.env.HDX_APP_ID;
  if (!appId) {
    console.warn("[ingest] HDX_APP_ID not set — HDX sources will be marked failed");
  }

  // 1. Fire all source modules. They run sequentially to be polite to the upstream APIs;
  //    parallelising is fine but offers no real speedup at 3 sources and risks rate limits.
  const oniRes = await run("noaa_oni", fetchOni);
  const rainfallRes = appId
    ? await run("hdx_rainfall", () => fetchHdxRainfall(appId, FOCUS_CODES))
    : { ok: false, value: null, error: "no HDX_APP_ID", ms: 0 };
  const foodRes = appId
    ? await run("hdx_food_security", () => fetchHdxFoodSecurity(appId, FOCUS_CODES))
    : { ok: false, value: null, error: "no HDX_APP_ID", ms: 0 };

  // 2. Load existing state (so we can preserve DEMO rows and previous history).
  const history = await readJson<HistoricalReading[]>("readings_history.json", []);
  const existingSectorRisk = await readJson<SectorRisk[]>("sector_risk.json", []);

  // 3. Merge LIVE indicators.
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

  // Dedupe history (key + observed_at) — keep most recent insert.
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

  // 4. Build sector_risk.json — keep existing DEMO rows untouched; overlay LIVE rows.
  const liveSectorRows: SectorRisk[] = [];
  if (rainfallRes.ok && rainfallRes.value) liveSectorRows.push(...rainfallRes.value.sector_rows);
  if (foodRes.ok && foodRes.value) liveSectorRows.push(...foodRes.value.rows);

  const liveKey = (r: SectorRisk) => `${r.province_code}::${r.sector}`;
  const liveKeys = new Set(liveSectorRows.map(liveKey));
  const preservedDemo = existingSectorRisk.filter(
    (r) => r.provenance === "DEMO" && !liveKeys.has(liveKey(r)),
  );
  const mergedSectorRisk = [...liveSectorRows, ...preservedDemo];

  // 5. National status: minimal honest rollup pending the risk engine.
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
    affected_population_est: 0, // populated by risk engine in Phase 3
    high_risk_province_count: highRiskProvinces.size,
    forecast_period: "Next 3 months",
    updated_at: new Date().toISOString(),
  };

  // 6. Write all files.
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

  console.log(`[ingest] done status=${lastRun.status}`);
  console.log(`[ingest] ${lastRun.notes}`);
}

main().catch((e) => {
  console.error("[ingest] FATAL", e);
  process.exit(1);
});
