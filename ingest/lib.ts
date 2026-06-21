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
import { fetchOni } from "./sources/oni";
import { fetchNoaaSoi } from "./sources/noaa-soi";
import { fetchNoaaTradeWind } from "./sources/noaa-trade-wind";
import { fetchCcsrNmme } from "./sources/ccsr-nmme";
import { fetchHdxFoodSecurity } from "./sources/hdx-food-security";
import { fetchHdxRainfall } from "./sources/hdx-rainfall";
import { fetchNasaPowerSoil } from "./sources/nasa-power-soil";
import { fetchNeoNdvi } from "./sources/neo-ndvi";
import { fetchFaoAsi } from "./sources/fao-asi";
import { fetchHdxAcled } from "./sources/hdx-acled";
import { fetchWhoGho } from "./sources/who-gho";
import { fetchWorldBank } from "./sources/world-bank";
import { fetchFaostat } from "./sources/faostat";
import { fetchOchaFts } from "./sources/ocha-fts";
import { fetchNasaEonet } from "./sources/nasa-eonet";
import { fetchUsgsEarthquakes } from "./sources/usgs-earthquakes";
import { fetchGdacs } from "./sources/gdacs";
import { fetchGvpVolcanoes, recencyLevel } from "./sources/gvp-volcanoes";
import { loadHazards } from "./sources/hazards-csv";
import { fetchOpenMeteo } from "./sources/open-meteo";
import { run } from "./sources/run";
import {
  readJson,
  writeJson,
  writePublicJson,
  loadProvincePopulations,
  loadProvincePolygons,
} from "./io";
import type {
  Indicator,
  HistoricalReading,
  SectorRisk,
  LastRun,
  RiskThreshold,
  Sector,
} from "../src/lib/types";
import { FOCUS_CODES, FOCUS_PROVINCES } from "../src/lib/focus-provinces";
import { rollUpNational, scoreSector, computeTrend as engineTrend } from "../src/lib/risk-engine";
import { deriveOutlook } from "../src/lib/outlook";

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

const computeTrend = engineTrend;

export async function runIngest(): Promise<LastRun> {
  const startedAt = new Date().toISOString();

  const appId = process.env.HDX_APP_ID;

  const oniRes = await run("noaa_oni", fetchOni);
  // NOAA CPC ENSO precursors — keyless monthly grids, always run. SOI is the
  // atmospheric confirmation of ONI's oceanic signal; trade-wind anomaly leads
  // both (warm-water displacement precedes surface SST by weeks–months).
  const soiRes = await run("noaa_soi", fetchNoaaSoi);
  const tradeWindRes = await run("noaa_trade_wind", fetchNoaaTradeWind);
  // NMME dynamical seasonal forecast (NOAA-GFDL SPEAR via IRI's open CCSR
  // OPeNDAP). This is the genuine model-grade ENSO forecast the operational
  // centres run — we RELAY it (display, not modelling), so the projected ONI is
  // badged LIVE. Drives the /forecast outlook; never the live national alert.
  const nmmeRes = await run("ccsr_nmme", fetchCcsrNmme);
  const rainfallRes = appId
    ? await run("hdx_rainfall", () => fetchHdxRainfall(appId, FOCUS_CODES))
    : { ok: false, value: null, error: "no HDX_APP_ID", ms: 0 };
  const foodRes = appId
    ? await run("hdx_food_security", () => fetchHdxFoodSecurity(appId, FOCUS_CODES))
    : { ok: false, value: null, error: "no HDX_APP_ID", ms: 0 };
  // NASA POWER is keyless and PNG-actionable — always run it.
  const soilRes = await run("nasa_power_soil", fetchNasaPowerSoil);
  // NASA NEO monthly NDVI — keyless global CSV grid. Vegetation-health anomaly,
  // the early canary for highland food-security stress. Always run.
  const ndviRes = await run("neo_ndvi", fetchNeoNdvi);
  // FAO GIEWS Agricultural Stress Index — keyless per-province CSV, the only
  // source giving PNG admin-1 drought data. Always run.
  const asiRes = await run("fao_asi", fetchFaoAsi);
  const acledRes = appId
    ? await run("hdx_acled", () => fetchHdxAcled(appId, FOCUS_CODES))
    : { ok: false, value: null, error: "no HDX_APP_ID", ms: 0 };
  // WHO GHO (Public Health, malaria-driven) and World Bank (Economic Stability,
  // inflation-driven) are keyless national feeds — always run. Each replicates
  // its national figure to the focus provinces, captioned as national-derived.
  const whoRes = await run("who_gho", () => fetchWhoGho(FOCUS_CODES));
  const wbRes = await run("world_bank", () => fetchWorldBank(FOCUS_CODES));
  // FAOSTAT undernourishment (Food Security floor) + OCHA FTS humanitarian
  // funding (Disaster & Hazard ops signal) — keyless national feeds, same
  // national-derived replication pattern. Both degrade gracefully if down.
  const faostatRes = await run("faostat", () => fetchFaostat(FOCUS_CODES));
  const ftsRes = await run("ocha_fts", () => fetchOchaFts(FOCUS_CODES));
  // Keyless sources — always run. Province polygons let USGS attribute each
  // epicentre to the province that contains it (real per-province seismic
  // counts) rather than replicating one national figure to every focus province.
  const provincePolygons = await loadProvincePolygons();
  const usgsRes = await run("usgs_earthquakes", () =>
    fetchUsgsEarthquakes(FOCUS_CODES, provincePolygons),
  );
  const gdacsRes = await run("gdacs", () => fetchGdacs(FOCUS_CODES));
  // GVP volcano hazard, attributed per province via the same polygons (with a
  // nearest-province fallback for offshore/submarine cones). Reps come from the
  // focus-province interior points used elsewhere for climate point queries.
  const provinceReps = FOCUS_PROVINCES.map((p) => ({ code: p.code, lon: p.lon, lat: p.lat }));
  const gvpRes = await run("gvp_volcanoes", () =>
    fetchGvpVolcanoes(FOCUS_CODES, provincePolygons, provinceReps),
  );
  // NASA EONET — unified active-hazard feed (volcanoes, storms, floods, drought,
  // wildfires, landslides), attributed per province by the same polygons + reps.
  const eonetRes = await run("nasa_eonet", () =>
    fetchNasaEonet(FOCUS_CODES, provincePolygons, provinceReps),
  );
  const openMeteoRes = await run("open_meteo", () => fetchOpenMeteo(FOCUS_CODES));

  const history = await readJson<HistoricalReading[]>("readings_history.json", []);
  const existingSectorRisk = await readJson<SectorRisk[]>("sector_risk.json", []);
  // Last-good indicators from the previous cycle. When a source fails this cycle
  // (transient network), we backfill its prior reading rather than blank the
  // gauge — CLAUDE.md §10: "show last-good + flag, never blank the dashboard."
  const previousIndicators = await readJson<Indicator[]>("indicators.json", []);

  const liveIndicators: Indicator[] = [];

  if (oniRes.ok && oniRes.value) {
    const ind = oniRes.value.indicator;
    ind.trend = computeTrend(ind.key, ind.value ?? 0, history, 0.05, 0.05, ind.observed_at);
    liveIndicators.push(ind);
    if (ind.value !== null) {
      history.push({ key: ind.key, value: ind.value, observed_at: ind.observed_at });
    }
  }

  // SOI + trade-wind: national ENSO-precursor gauges (no per-province rows).
  if (soiRes.ok && soiRes.value) {
    const ind = soiRes.value.indicator;
    if (ind.value !== null) {
      ind.trend = computeTrend(ind.key, ind.value, history, 0.05, 0.05, ind.observed_at);
      liveIndicators.push(ind);
      history.push({ key: ind.key, value: ind.value, observed_at: ind.observed_at });
    }
  }

  if (tradeWindRes.ok && tradeWindRes.value) {
    const ind = tradeWindRes.value.indicator;
    if (ind.value !== null) {
      ind.trend = computeTrend(ind.key, ind.value, history, 0.05, 0.05, ind.observed_at);
      liveIndicators.push(ind);
      history.push({ key: ind.key, value: ind.value, observed_at: ind.observed_at });
    }
  }

  // PROJECTED_ONI: the relayed NMME forecast. A forward-looking gauge — shown on
  // /forecast and excluded from the live alert in rollUpNational. Trend compares
  // successive forecast inits (is the projection trending hotter month-on-month).
  if (nmmeRes.ok && nmmeRes.value) {
    const ind = nmmeRes.value.indicator;
    if (ind.value !== null) {
      ind.trend = computeTrend(ind.key, ind.value, history, 0.05, 0.05, ind.observed_at);
      liveIndicators.push(ind);
      history.push({ key: ind.key, value: ind.value, observed_at: ind.observed_at });
    }
  }

  if (rainfallRes.ok && rainfallRes.value) {
    const ind = rainfallRes.value.indicator;
    if (ind.value !== null) {
      ind.trend = computeTrend(ind.key, ind.value, history, 0.05, 0.05, ind.observed_at);
      liveIndicators.push(ind);
      history.push({ key: ind.key, value: ind.value, observed_at: ind.observed_at });
    }
  }

  if (soilRes.ok && soilRes.value) {
    const ind = soilRes.value.indicator;
    if (ind.value !== null) {
      ind.trend = computeTrend(ind.key, ind.value, history, 0.05, 0.05, ind.observed_at);
      liveIndicators.push(ind);
      history.push({ key: ind.key, value: ind.value, observed_at: ind.observed_at });
    }
  }

  // NDVI vegetation-health anomaly (NASA NEO MODIS). Signed anomaly vs the
  // same-month multi-year mean — negative = vegetation below normal = stress.
  if (ndviRes.ok && ndviRes.value) {
    const ind = ndviRes.value.indicator;
    if (ind.value !== null) {
      ind.trend = computeTrend(ind.key, ind.value, history, 0.05, 0.05, ind.observed_at);
      liveIndicators.push(ind);
      history.push({ key: ind.key, value: ind.value, observed_at: ind.observed_at });
    }
  }

  // FAO ASI — provincial agricultural-stress index (% cropland in drought). The
  // agronomic complement to NDVI: how much of the actual CROP area is stressed.
  if (asiRes.ok && asiRes.value) {
    const ind = asiRes.value.indicator;
    if (ind.value !== null) {
      ind.trend = computeTrend(ind.key, ind.value, history, 0.05, 0.05, ind.observed_at);
      liveIndicators.push(ind);
      history.push({ key: ind.key, value: ind.value, observed_at: ind.observed_at });
    }
  }

  // USGS seismic tempo — a standing PNG hazard indicator (Ring of Fire).
  if (usgsRes.ok && usgsRes.value) {
    const ind = usgsRes.value.indicator;
    if (ind.value !== null) {
      ind.trend = computeTrend(ind.key, ind.value, history, 0.05, 0.05, ind.observed_at);
      liveIndicators.push(ind);
      history.push({ key: ind.key, value: ind.value, observed_at: ind.observed_at });
    }
  }

  // WHO GHO malaria incidence — the Public Health gauge (annual, national).
  if (whoRes.ok && whoRes.value) {
    const ind = whoRes.value.indicator;
    if (ind.value !== null) {
      ind.trend = computeTrend(ind.key, ind.value, history, 0.05, 0.05, ind.observed_at);
      liveIndicators.push(ind);
      history.push({ key: ind.key, value: ind.value, observed_at: ind.observed_at });
    }
  }

  // FAOSTAT undernourishment — the Food Security structural-floor gauge (annual,
  // national 3-yr mean). A slow baseline, excluded from the ENSO alert rollup.
  if (faostatRes.ok && faostatRes.value) {
    const ind = faostatRes.value.indicator;
    if (ind.value !== null) {
      ind.trend = computeTrend(ind.key, ind.value, history, 0.05, 0.05, ind.observed_at);
      liveIndicators.push(ind);
      history.push({ key: ind.key, value: ind.value, observed_at: ind.observed_at });
    }
  }

  // World Bank CPI inflation — the Economic Stability gauge (annual, national).
  if (wbRes.ok && wbRes.value) {
    const ind = wbRes.value.indicator;
    if (ind.value !== null) {
      ind.trend = computeTrend(ind.key, ind.value, history, 0.05, 0.05, ind.observed_at);
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
        ind.trend = computeTrend(ind.key, ind.value, history, 0.05, 0.05, ind.observed_at);
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
    // Daily watch indicators (RAINFALL_DAILY, WIND_ANOM): additive, promoted
    // every cycle Open-Meteo succeeds — NOT gated on a primary feed. They sit
    // in the risk engine's NON_ALERT_KEYS so they never raise the national alert.
    const rainDaily = openMeteoRes.value.rainfall_daily_indicator;
    if (rainDaily.value !== null) {
      rainDaily.trend = computeTrend(rainDaily.key, rainDaily.value, history, 0.05, 0.05, rainDaily.observed_at);
      liveIndicators.push(rainDaily);
      history.push({ key: rainDaily.key, value: rainDaily.value, observed_at: rainDaily.observed_at });
    }
    const windAnom = openMeteoRes.value.wind_anom_indicator;
    if (windAnom.value !== null) {
      windAnom.trend = computeTrend(windAnom.key, windAnom.value, history, 0.05, 0.05, windAnom.observed_at);
      liveIndicators.push(windAnom);
      history.push({ key: windAnom.key, value: windAnom.value, observed_at: windAnom.observed_at });
    }
  }

  // Backfill last-good: any indicator the previous cycle had but this cycle
  // failed to produce (source down) carries forward, so the gauge shows its
  // last real reading instead of vanishing. Its stale observed_at + the failed
  // source flag in last_run.json together signal the staleness honestly — we
  // never fabricate a fresh LIVE reading.
  // EXCEPT retired keys: the old DEMO/REFERENCE forecast seeds (WWV, the
  // ENSO-probability plume, the placeholder dynamical projection) were dropped
  // when the LIVE NMME forecast landed. They must not carry forward from a stale
  // indicators.json, or they'd resurrect as zombie gauges.
  const RETIRED_KEYS = new Set(["WWV", "ENSO_PROB", "DYN_FORECAST"]);
  const liveKeys = new Set(liveIndicators.map((i) => i.key));
  for (const prev of previousIndicators) {
    if (RETIRED_KEYS.has(prev.key)) continue;
    if (!liveKeys.has(prev.key)) liveIndicators.push(prev);
  }

  // The forward-looking ENSO outlook is now driven by a GENUINELY LIVE feed: the
  // NMME dynamical forecast (PROJECTED_ONI, pushed above) relayed from IRI's open
  // CCSR OPeNDAP server. The earlier DEMO/REFERENCE seeds (warm-water volume, the
  // ENSO-probability plume, a placeholder CFSv2/SEAS5 projection) are dropped — we
  // no longer seed an outlook we couldn't source, per the credibility rule.

  const seen = new Set<string>();
  const dedupedHistory = [...history]
    .reverse()
    .filter((h) => {
      if (RETIRED_KEYS.has(h.key)) return false; // drop retired seed history
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
  // NDVI vegetation anomaly → per-province Food Security rows (max-merged below).
  if (ndviRes.ok && ndviRes.value) upstreamRows.push(...ndviRes.value.sector_rows);
  // FAO ASI → per-province Food Security rows (max-merged with NDVI/rainfall).
  if (asiRes.ok && asiRes.value) upstreamRows.push(...asiRes.value.sector_rows);
  if (foodRes.ok && foodRes.value) upstreamRows.push(...foodRes.value.rows);
  if (acledRes.ok && acledRes.value) upstreamRows.push(...acledRes.value.sector_rows);
  // WHO GHO → per-province Public Health rows; World Bank → Economic Stability
  // rows. Both national-derived (replicated to focus provinces, captioned so).
  if (whoRes.ok && whoRes.value) upstreamRows.push(...whoRes.value.sector_rows);
  if (wbRes.ok && wbRes.value) upstreamRows.push(...wbRes.value.sector_rows);
  if (faostatRes.ok && faostatRes.value) upstreamRows.push(...faostatRes.value.sector_rows);
  if (ftsRes.ok && ftsRes.value) upstreamRows.push(...ftsRes.value.sector_rows);
  // Disaster & Hazard: GDACS multi-hazard alert + USGS seismic + GVP volcano
  // hazard, all per-province and max-merged below. GVP attributes each PNG
  // volcano to its province (point-in-polygon, nearest fallback offshore), so a
  // province with an active volcano escalates while volcano-free provinces don't.
  if (gdacsRes.ok && gdacsRes.value) upstreamRows.push(...gdacsRes.value.sector_rows);
  if (usgsRes.ok && usgsRes.value) upstreamRows.push(...usgsRes.value.sector_rows);
  if (gvpRes.ok && gvpRes.value) upstreamRows.push(...gvpRes.value.sector_rows);
  if (eonetRes.ok && eonetRes.value) upstreamRows.push(...eonetRes.value.sector_rows);
  // Open-Meteo Water Security rows only when HDX rainfall is absent (backstop).
  if (openMeteoRes.ok && openMeteoRes.value && !(rainfallRes.ok && rainfallRes.value)) {
    upstreamRows.push(...openMeteoRes.value.sector_rows);
  }
  // Storm-day Disaster & Hazard rows: emitted whenever the 7-day window saw any
  // storm-force day, independent of the rainfall backstop gate above. Per focus
  // province so the map's Disaster cell escalates with the storm tempo.
  if (openMeteoRes.ok && openMeteoRes.value && openMeteoRes.value.storm_days > 0) {
    const sd = openMeteoRes.value.storm_days;
    const level: SectorRisk["level"] = sd >= 5 ? "high" : sd >= 3 ? "med" : "low";
    for (const code of FOCUS_CODES) {
      upstreamRows.push({
        province_code: code,
        sector: "Disaster & Hazard",
        level,
        score: Math.min(1, sd / 7),
        trend: "flat",
        provenance: "LIVE",
        as_of: startedAt,
        data_source: `Open-Meteo · ${sd} storm-day${sd === 1 ? "" : "s"} / 7 (≥10.8 m/s)`,
      });
    }
  }

  // When two upstream sources target the same (province, sector) cell, collapse
  // to the worst — explainable, no opaque weighting. Higher level always wins;
  // on a level tie the higher score wins, so the more specific signal keeps the
  // cell (e.g. a named GVP volcano beats a generic GDACS green regional alert,
  // both "low", because the volcano carries a small within-band score floor).
  const RISK_RANK = { low: 0, med: 1, high: 2, critical: 3 } as const;
  const collapsed = new Map<string, SectorRisk>();
  for (const r of upstreamRows) {
    const key = `${r.province_code}::${r.sector}`;
    const prev = collapsed.get(key);
    const better =
      !prev ||
      RISK_RANK[r.level] > RISK_RANK[prev.level] ||
      (RISK_RANK[r.level] === RISK_RANK[prev.level] && r.score > prev.score);
    if (better) collapsed.set(key, r);
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
          asOf: startedAt,
        }),
      );
    }
  }

  // 5b. Cell trends from the prior cycle. Several live sources (ACLED, USGS,
  //     GDACS) report a national signal and hardcode trend="flat" because they
  //     have no per-cell history. Here we derive a REAL trend by comparing this
  //     cycle's score to the previous cycle's score for the same (province,
  //     sector), with a dead-band so measurement noise doesn't flip the arrow.
  //     This only adjusts LIVE cells; DEMO/seed rows keep their authored trend.
  const TREND_DEADBAND = 0.05; // score units (0..1); ~one-sixth of a risk band
  const priorScoreByKey = new Map(
    existingSectorRisk.map((r) => [`${r.province_code}::${r.sector}`, r.score]),
  );
  for (const row of engineRows) {
    if (row.provenance !== "LIVE") continue;
    const prior = priorScoreByKey.get(`${row.province_code}::${row.sector}`);
    if (prior === undefined) continue; // first sighting → keep flat
    const delta = row.score - prior;
    row.trend = Math.abs(delta) < TREND_DEADBAND ? "flat" : delta > 0 ? "up" : "down";
  }

  // 6. Merge: engine rows for focus provinces overlay everything; preserve unrelated
  //    DEMO rows (e.g. non-focus provinces) untouched.
  const engineKeys = new Set(engineRows.map((r) => `${r.province_code}::${r.sector}`));
  const preservedDemo = existingSectorRisk.filter(
    (r) => r.provenance === "DEMO" && !engineKeys.has(`${r.province_code}::${r.sector}`),
  );
  const mergedSectorRisk = [...engineRows, ...preservedDemo];

  // 7. National rollup via the engine. Province populations come straight from
  //    provinces.geojson so affected_population_est is a real, traceable figure
  //    (summed population of high/critical provinces), not a hardcoded placeholder.
  const populationByCode = await loadProvincePopulations();
  const nationalStatus = rollUpNational(
    liveIndicators,
    thresholds,
    mergedSectorRisk,
    FOCUS_CODES,
    "Next 3 months",
    populationByCode,
    startedAt,
  );

  await writeJson("indicators.json", liveIndicators);
  await writeJson("readings_history.json", dedupedHistory);
  await writeJson("sector_risk.json", mergedSectorRisk);
  await writeJson("national_status.json", nationalStatus);

  // Forecast bundle for the /forecast page: the NMME ensemble plume (per-member
  // projected ONI + mean/min/max + target window) plus the precursor-alignment
  // outlook derived from the present-state ENSO signals. Outlook is a pure read
  // over liveIndicators — relayed model + diagnostic alignment, never a NEWCIS
  // forecast. Written whether or not the model fetch succeeded: on failure the
  // page degrades to the precursor panel alone (LIVE) and flags the missing model.
  const outlook = deriveOutlook(
    liveIndicators,
    thresholds,
    nmmeRes.ok && nmmeRes.value ? nmmeRes.value.target_window : null,
  );
  await writeJson("forecast.json", {
    generated_at: new Date().toISOString(),
    model: nmmeRes.ok && nmmeRes.value
      ? {
          provenance: "LIVE" as const,
          source: nmmeRes.value.indicator.source,
          init_month: nmmeRes.value.init_month,
          target_window: nmmeRes.value.target_window,
          ensemble_mean: nmmeRes.value.ensemble_mean,
          ensemble_min: nmmeRes.value.ensemble_min,
          ensemble_max: nmmeRes.value.ensemble_max,
          members: nmmeRes.value.members,
        }
      : null,
    outlook,
  });

  // Persist the volcanoes that actually erupted in the MODERN record (last 100
  // years) at their real coordinates, for the map to render — not the one-worst-
  // per-province that drives the matrix cell. We deliberately EXCLUDE volcanoes
  // with no dated eruption and centuries-old / Pleistocene cones: an undated or
  // 1580 eruption is not a current hazard and only clutters the operating picture.
  // This still shows every recent eruption — Manam/Langila/Ulawun/Bagana (active),
  // Rabaul 2014, Karkar 1979 — and is why Madang shows Manam AND Karkar, with a
  // marker on Umboi Island, not a province centroid. Written to /public so the
  // client map can fetch it like provinces.geojson.
  const VOLCANO_RECENCY_YEARS = 100; // modern-record window for map markers
  const currentYear = new Date().getUTCFullYear();
  const volcanoFeatures = (gvpRes.ok && gvpRes.value ? gvpRes.value.volcanoes : [])
    .filter(
      (v) =>
        v.lastEruptionYear !== null && currentYear - v.lastEruptionYear <= VOLCANO_RECENCY_YEARS,
    )
    .map((v) => ({
      name: v.name,
      type: v.type,
      last_eruption_year: v.lastEruptionYear,
      lon: v.lon,
      lat: v.lat,
      province_code: v.provinceCode,
      attribution: v.attribution,
      level: recencyLevel(v.lastEruptionYear, currentYear),
    }));
  await writePublicJson("volcanoes.json", {
    source: "Smithsonian Global Volcanism Program (GVP) · VOTW Holocene",
    recency_window_years: VOLCANO_RECENCY_YEARS,
    note: `volcanoes with a dated eruption within the last ${VOLCANO_RECENCY_YEARS} years`,
    generated_at: new Date().toISOString(),
    count: volcanoFeatures.length,
    volcanoes: volcanoFeatures,
  });

  // Curated historical-hazard layers (volcanoes / tsunamis / major disasters)
  // parsed + geocoded from the hand-compiled CSVs in /data. These are toggleable
  // reference layers on the map — provenance REFERENCE, never LIVE. Written to
  // /public so the client map can fetch them like the other map artefacts.
  const hazards = await loadHazards();
  await writePublicJson("hazards.json", {
    source: "NEWCIS curated PNG hazard record (volcanoes, tsunamis, major disasters)",
    provenance: "REFERENCE",
    generated_at: new Date().toISOString(),
    by_kind: hazards.by_kind,
    count: hazards.events.length,
    events: hazards.events,
  });

  const lastRun: LastRun = {
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    status: [oniRes, soiRes, tradeWindRes, nmmeRes, rainfallRes, foodRes, soilRes, ndviRes, asiRes, acledRes, whoRes, wbRes, faostatRes, ftsRes, usgsRes, gdacsRes, gvpRes, eonetRes, openMeteoRes].every((r) => r.ok)
      ? "ok"
      : [oniRes, soiRes, tradeWindRes, nmmeRes, rainfallRes, foodRes, soilRes, ndviRes, asiRes, acledRes, whoRes, wbRes, faostatRes, ftsRes, usgsRes, gdacsRes, gvpRes, eonetRes, openMeteoRes].some((r) => r.ok)
        ? "partial"
        : "failed",
    sources_ok: {
      noaa_oni: oniRes.ok,
      noaa_soi: soiRes.ok,
      noaa_trade_wind: tradeWindRes.ok,
      ccsr_nmme: nmmeRes.ok,
      hdx_rainfall: rainfallRes.ok,
      hdx_food_security: foodRes.ok,
      nasa_power_soil: soilRes.ok,
      neo_ndvi: ndviRes.ok,
      fao_asi: asiRes.ok,
      hdx_acled: acledRes.ok,
      who_gho: whoRes.ok,
      world_bank: wbRes.ok,
      faostat: faostatRes.ok,
      ocha_fts: ftsRes.ok,
      usgs_earthquakes: usgsRes.ok,
      gdacs: gdacsRes.ok,
      gvp_volcanoes: gvpRes.ok,
      nasa_eonet: eonetRes.ok,
      open_meteo: openMeteoRes.ok,
    },
    notes: [
      oniRes.ok ? `ONI ${oniRes.value?.indicator.value} (${oniRes.ms}ms)` : `ONI failed: ${oniRes.error}`,
      soiRes.ok ? `SOI ${soiRes.value?.indicator.value} (${soiRes.ms}ms)` : `SOI failed: ${soiRes.error}`,
      tradeWindRes.ok ? `Trade-wind ${tradeWindRes.value?.indicator.value} (${tradeWindRes.ms}ms)` : `Trade-wind failed: ${tradeWindRes.error}`,
      nmmeRes.ok ? `NMME projected ONI ${nmmeRes.value?.ensemble_mean} (${nmmeRes.value?.target_window}, ${nmmeRes.value?.members.length} members, ${nmmeRes.ms}ms)` : `NMME failed: ${nmmeRes.error}`,
      rainfallRes.ok
        ? `Rainfall mean anom ${rainfallRes.value?.indicator.value}% (${rainfallRes.value?.reporting_count}/${rainfallRes.value?.focus_count} provinces reporting, ${rainfallRes.value?.raw_count} raw rows, ${rainfallRes.ms}ms)`
        : `Rainfall failed: ${rainfallRes.error}`,
      foodRes.ok ? `Food security: ${foodRes.value?.note}` : `Food security failed: ${foodRes.error}`,
      soilRes.ok
        ? `Soil moisture median ${soilRes.value?.indicator.value}th pctile (${soilRes.value?.per_province.length} provinces, ${soilRes.ms}ms)`
        : `Soil moisture failed: ${soilRes.error}`,
      ndviRes.ok ? `${ndviRes.value?.note} (${ndviRes.ms}ms)` : `NDVI failed: ${ndviRes.error}`,
      asiRes.ok ? `${asiRes.value?.note} (${asiRes.ms}ms)` : `FAO ASI failed: ${asiRes.error}`,
      acledRes.ok ? `ACLED: ${acledRes.value?.note}` : `ACLED failed: ${acledRes.error}`,
      whoRes.ok ? `WHO GHO: ${whoRes.value?.note} (${whoRes.ms}ms)` : `WHO GHO failed: ${whoRes.error}`,
      wbRes.ok ? `World Bank: ${wbRes.value?.note} (${wbRes.ms}ms)` : `World Bank failed: ${wbRes.error}`,
      faostatRes.ok ? `FAOSTAT: ${faostatRes.value?.note} (${faostatRes.ms}ms)` : `FAOSTAT failed: ${faostatRes.error}`,
      ftsRes.ok ? `OCHA FTS: ${ftsRes.value?.note} (${ftsRes.ms}ms)` : `OCHA FTS failed: ${ftsRes.error}`,
      usgsRes.ok ? `USGS: ${usgsRes.value?.note} (${usgsRes.ms}ms)` : `USGS failed: ${usgsRes.error}`,
      gdacsRes.ok ? `GDACS: ${gdacsRes.value?.note} (${gdacsRes.ms}ms)` : `GDACS failed: ${gdacsRes.error}`,
      gvpRes.ok ? `GVP volcanoes: ${gvpRes.value?.note} (${gvpRes.ms}ms)` : `GVP volcanoes failed: ${gvpRes.error}`,
      eonetRes.ok ? `NASA EONET: ${eonetRes.value?.note} (${eonetRes.ms}ms)` : `NASA EONET failed: ${eonetRes.error}`,
      openMeteoRes.ok ? `Open-Meteo: ${openMeteoRes.value?.note} (${openMeteoRes.ms}ms)` : `Open-Meteo failed: ${openMeteoRes.error}`,
    ].join(" | "),
  };
  await writeJson("last_run.json", lastRun);

  return lastRun;
}
