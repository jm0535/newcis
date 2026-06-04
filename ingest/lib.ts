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
import { fetchNasaPowerSoil } from "./sources/nasa-power-soil";
import { fetchHdxAcled } from "./sources/hdx-acled";
import { fetchUsgsEarthquakes } from "./sources/usgs-earthquakes";
import { fetchGdacs } from "./sources/gdacs";
import { fetchOpenMeteo } from "./sources/open-meteo";
import type {
  Indicator,
  HistoricalReading,
  SectorRisk,
  LastRun,
  NationalStatus,
  RiskThreshold,
  Sector,
} from "../src/lib/types";
import { FOCUS_CODES } from "../src/lib/focus-provinces";
import { rollUpNational, scoreSector, computeTrend as engineTrend } from "../src/lib/risk-engine";

const SECTORS: Sector[] = [
  "Food Security",
  "Water Security",
  "Public Health",
  "Economic Stability",
  "Infrastructure",
  "Energy Security",
  "Social Stability",
  "Disaster & Hazard",
];

const DATA = path.join(process.cwd(), "data");

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
  // NASA POWER is keyless and PNG-actionable — always run it.
  const soilRes = await run("nasa_power_soil", fetchNasaPowerSoil);
  const acledRes = appId
    ? await run("hdx_acled", () => fetchHdxAcled(appId, FOCUS_CODES))
    : { ok: false, value: null, error: "no HDX_APP_ID", ms: 0 };
  // Keyless sources — always run.
  const usgsRes = await run("usgs_earthquakes", () => fetchUsgsEarthquakes(FOCUS_CODES));
  const gdacsRes = await run("gdacs", () => fetchGdacs(FOCUS_CODES));
  const openMeteoRes = await run("open_meteo", () => fetchOpenMeteo(FOCUS_CODES));

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

  if (soilRes.ok && soilRes.value) {
    const ind = soilRes.value.indicator;
    if (ind.value !== null) {
      ind.trend = computeTrend(ind.key, ind.value, history);
      liveIndicators.push(ind);
      history.push({ key: ind.key, value: ind.value, observed_at: ind.observed_at });
    }
  }

  // USGS seismic tempo — a standing PNG hazard indicator (Ring of Fire).
  if (usgsRes.ok && usgsRes.value) {
    const ind = usgsRes.value.indicator;
    if (ind.value !== null) {
      ind.trend = computeTrend(ind.key, ind.value, history);
      liveIndicators.push(ind);
      history.push({ key: ind.key, value: ind.value, observed_at: ind.observed_at });
    }
  }

  // Open-Meteo backstop: PROMOTE its rainfall/temp anomalies only when the
  // primary feed is absent, so we never double-count. HDX is the primary for
  // RAINFALL_ANOM; TEMP_ANOM has no primary feed, so Open-Meteo always supplies it.
  if (openMeteoRes.ok && openMeteoRes.value) {
    const haveRainfall = liveIndicators.some((i) => i.key === "RAINFALL_ANOM");
    if (!haveRainfall) {
      const ind = openMeteoRes.value.rainfall_indicator;
      if (ind.value !== null) {
        ind.trend = computeTrend(ind.key, ind.value, history);
        liveIndicators.push(ind);
        history.push({ key: ind.key, value: ind.value, observed_at: ind.observed_at });
      }
    }
    const tempInd = openMeteoRes.value.temp_indicator;
    if (tempInd.value !== null) {
      tempInd.trend = computeTrend(tempInd.key, tempInd.value, history);
      liveIndicators.push(tempInd);
      history.push({ key: tempInd.key, value: tempInd.value, observed_at: tempInd.observed_at });
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

  // 4. Source-derived sector rows. Rainfall + SMAP both feed Water Security at the
  //    province level — they're complementary (instantaneous rain vs root-zone state),
  //    so we keep both and let the engine take the worst risk via scoreSector's
  //    max-merge against the indicator-driven baseline.
  const upstreamRows: SectorRisk[] = [];
  if (rainfallRes.ok && rainfallRes.value) upstreamRows.push(...rainfallRes.value.sector_rows);
  if (soilRes.ok && soilRes.value) upstreamRows.push(...soilRes.value.sector_rows);
  if (foodRes.ok && foodRes.value) upstreamRows.push(...foodRes.value.rows);
  if (acledRes.ok && acledRes.value) upstreamRows.push(...acledRes.value.sector_rows);
  // Disaster & Hazard: GDACS multi-hazard alert + USGS seismic, max-merged below.
  if (gdacsRes.ok && gdacsRes.value) upstreamRows.push(...gdacsRes.value.sector_rows);
  if (usgsRes.ok && usgsRes.value) upstreamRows.push(...usgsRes.value.sector_rows);
  // Open-Meteo Water Security rows only when HDX rainfall is absent (backstop).
  if (openMeteoRes.ok && openMeteoRes.value && !(rainfallRes.ok && rainfallRes.value)) {
    upstreamRows.push(...openMeteoRes.value.sector_rows);
  }

  // When two upstream sources target the same (province, sector) cell, collapse
  // to the worst — explainable, no opaque weighting.
  const RISK_RANK = { low: 0, med: 1, high: 2, critical: 3 } as const;
  const collapsed = new Map<string, SectorRisk>();
  for (const r of upstreamRows) {
    const key = `${r.province_code}::${r.sector}`;
    const prev = collapsed.get(key);
    if (!prev || RISK_RANK[r.level] > RISK_RANK[prev.level]) collapsed.set(key, r);
  }
  const mergedUpstream = Array.from(collapsed.values());

  // 5. Risk engine: produce a SectorRisk cell for every (focus province × sector),
  //    combining national indicators with any matching upstream row. Seed rows
  //    (data/sector_risk_seed.json) feed in for gap sectors with no live driver
  //    — the engine sees them and only overrides when it has a stronger signal.
  const thresholds = await readJson<RiskThreshold[]>("risk_thresholds.json", []);
  const seedRows = await readJson<SectorRisk[]>("sector_risk_seed.json", []);
  const seedByKey = new Map(seedRows.map((r) => [`${r.province_code}::${r.sector}`, r]));
  const upstreamByKey = new Map(mergedUpstream.map((r) => [`${r.province_code}::${r.sector}`, r]));
  const engineRows: SectorRisk[] = [];
  for (const provinceCode of FOCUS_CODES) {
    for (const sector of SECTORS) {
      const key = `${provinceCode}::${sector}`;
      // Seed acts as the baseline for indicator-less sectors. LIVE upstream
      // (e.g. CHIRPS rainfall) always wins via provinceSectorRow.
      const baseline = upstreamByKey.get(key) ?? seedByKey.get(key);
      engineRows.push(
        scoreSector(provinceCode, sector, {
          indicators: liveIndicators,
          thresholds,
          provinceSectorRow: baseline,
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
    status: [oniRes, rainfallRes, foodRes, soilRes, acledRes, usgsRes, gdacsRes, openMeteoRes].every((r) => r.ok)
      ? "ok"
      : [oniRes, rainfallRes, foodRes, soilRes, acledRes, usgsRes, gdacsRes, openMeteoRes].some((r) => r.ok)
        ? "partial"
        : "failed",
    sources_ok: {
      noaa_oni: oniRes.ok,
      hdx_rainfall: rainfallRes.ok,
      hdx_food_security: foodRes.ok,
      nasa_power_soil: soilRes.ok,
      hdx_acled: acledRes.ok,
      usgs_earthquakes: usgsRes.ok,
      gdacs: gdacsRes.ok,
      open_meteo: openMeteoRes.ok,
    },
    notes: [
      oniRes.ok ? `ONI ${oniRes.value?.indicator.value} (${oniRes.ms}ms)` : `ONI failed: ${oniRes.error}`,
      rainfallRes.ok
        ? `Rainfall mean anom ${rainfallRes.value?.indicator.value}% (${rainfallRes.value?.raw_count} raw rows, ${rainfallRes.ms}ms)`
        : `Rainfall failed: ${rainfallRes.error}`,
      foodRes.ok ? `Food security: ${foodRes.value?.note}` : `Food security failed: ${foodRes.error}`,
      soilRes.ok
        ? `Soil moisture mean ${soilRes.value?.indicator.value}th pctile (${soilRes.ms}ms)`
        : `Soil moisture failed: ${soilRes.error}`,
      acledRes.ok ? `ACLED: ${acledRes.value?.note}` : `ACLED failed: ${acledRes.error}`,
      usgsRes.ok ? `USGS: ${usgsRes.value?.note} (${usgsRes.ms}ms)` : `USGS failed: ${usgsRes.error}`,
      gdacsRes.ok ? `GDACS: ${gdacsRes.value?.note} (${gdacsRes.ms}ms)` : `GDACS failed: ${gdacsRes.error}`,
      openMeteoRes.ok ? `Open-Meteo: ${openMeteoRes.value?.note} (${openMeteoRes.ms}ms)` : `Open-Meteo failed: ${openMeteoRes.error}`,
    ].join(" | "),
  };
  await writeJson("last_run.json", lastRun);

  return lastRun;
}
