/**
 * Ingest writers + health-record builder. Extracted from lib.ts to keep the
 * orchestrator thin: lib.ts decides WHAT to fetch and how risk rolls up; this
 * module owns the mechanical construction of the map/forecast artefacts and the
 * last_run health record. No fetching, no risk logic — pure shaping of values
 * the orchestrator already has in hand.
 */
import { writeJson, writePublicJson } from "./io";
import { recencyLevel } from "./sources/gvp-volcanoes";
import { deriveOutlook } from "../src/lib/outlook";
import type { SourceResult } from "./sources/run";
import type { Indicator, RiskThreshold, LastRun } from "../src/lib/types";
import type { CcsrNmmeResult } from "./sources/ccsr-nmme";
import type { GvpVolcanoResult } from "./sources/gvp-volcanoes";

interface LoadedHazards {
  by_kind: Record<string, number>;
  events: unknown[];
}

// The forecast bundle for /forecast: the NMME ensemble plume plus the
// precursor-alignment outlook derived from present-state ENSO signals. Outlook is
// a pure read over the live indicators — relayed model + diagnostic alignment,
// never a NEWCIS forecast. Written whether or not the model fetch succeeded: on
// failure the page degrades to the precursor panel alone (LIVE) and flags the
// missing model.
export async function writeForecastBundle(
  liveIndicators: Indicator[],
  thresholds: RiskThreshold[],
  nmmeRes: SourceResult<CcsrNmmeResult>,
): Promise<void> {
  const outlook = deriveOutlook(
    liveIndicators,
    thresholds,
    nmmeRes.ok && nmmeRes.value ? nmmeRes.value.target_window : null,
  );
  await writeJson("forecast.json", {
    generated_at: new Date().toISOString(),
    model:
      nmmeRes.ok && nmmeRes.value
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
}

// Persist the volcanoes that actually erupted in the MODERN record (last 100
// years) at their real coordinates, for the map to render — not the one-worst-
// per-province that drives the matrix cell. We deliberately EXCLUDE volcanoes
// with no dated eruption and centuries-old / Pleistocene cones: an undated or
// 1580 eruption is not a current hazard and only clutters the operating picture.
// This still shows every recent eruption — Manam/Langila/Ulawun/Bagana (active),
// Rabaul 2014, Karkar 1979 — and is why Madang shows Manam AND Karkar, with a
// marker on Umboi Island, not a province centroid. Written to /public so the
// client map can fetch it like provinces.geojson.
export async function writeVolcanoes(gvpRes: SourceResult<GvpVolcanoResult>): Promise<void> {
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
}

// Curated historical-hazard layers (volcanoes / tsunamis / major disasters)
// parsed + geocoded from the hand-compiled CSVs in /data. These are toggleable
// reference layers on the map — provenance REFERENCE, never LIVE. Written to
// /public so the client map can fetch them like the other map artefacts.
export async function writeHazards(hazards: LoadedHazards): Promise<void> {
  await writePublicJson("hazards.json", {
    source: "NEWCIS curated PNG hazard record (volcanoes, tsunamis, major disasters)",
    provenance: "REFERENCE",
    generated_at: new Date().toISOString(),
    by_kind: hazards.by_kind,
    count: hazards.events.length,
    events: hazards.events,
  });
}

// All source results, keyed by the same name passed to run(). buildLastRun reads
// each result's ok flag (for the health rollup + sources_ok map) and its value's
// note/indicator fields (for the human-readable notes line). The orchestrator
// passes the live result objects; their concrete value types are inferred here.
export interface IngestResults {
  oniRes: SourceResult<{ indicator: { value: number | null } }>;
  soiRes: SourceResult<{ indicator: { value: number | null } }>;
  tradeWindRes: SourceResult<{ indicator: { value: number | null } }>;
  nmmeRes: SourceResult<{
    ensemble_mean: number;
    target_window: string;
    members: number[];
  }>;
  rainfallRes: SourceResult<{
    indicator: { value: number | null };
    reporting_count: number;
    focus_count: number;
    raw_count: number;
  }>;
  foodRes: SourceResult<{ note: string }>;
  soilRes: SourceResult<{
    indicator: { value: number | null };
    per_province: unknown[];
  }>;
  ndviRes: SourceResult<{ note: string }>;
  asiRes: SourceResult<{ note: string }>;
  acledRes: SourceResult<{ note: string }>;
  whoRes: SourceResult<{ note: string }>;
  wbRes: SourceResult<{ note: string }>;
  faostatRes: SourceResult<{ note: string }>;
  ftsRes: SourceResult<{ note: string }>;
  usgsRes: SourceResult<{ note: string }>;
  gdacsRes: SourceResult<{ note: string }>;
  gvpRes: SourceResult<{ note: string }>;
  eonetRes: SourceResult<{ note: string }>;
  openMeteoRes: SourceResult<{ note: string }>;
}

// Assemble the last_run health record from every source result. Status is "ok"
// when all succeeded, "partial" when some did, "failed" when none. sources_ok is
// the per-source flag map the dashboard's data-health badge reads; notes is a
// single human-readable line summarising each source's value or failure.
export async function writeLastRun(startedAt: string, r: IngestResults): Promise<LastRun> {
  const all = [
    r.oniRes, r.soiRes, r.tradeWindRes, r.nmmeRes, r.rainfallRes, r.foodRes, r.soilRes,
    r.ndviRes, r.asiRes, r.acledRes, r.whoRes, r.wbRes, r.faostatRes, r.ftsRes, r.usgsRes,
    r.gdacsRes, r.gvpRes, r.eonetRes, r.openMeteoRes,
  ];
  const lastRun: LastRun = {
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    status: all.every((x) => x.ok) ? "ok" : all.some((x) => x.ok) ? "partial" : "failed",
    sources_ok: {
      noaa_oni: r.oniRes.ok,
      noaa_soi: r.soiRes.ok,
      noaa_trade_wind: r.tradeWindRes.ok,
      ccsr_nmme: r.nmmeRes.ok,
      hdx_rainfall: r.rainfallRes.ok,
      hdx_food_security: r.foodRes.ok,
      nasa_power_soil: r.soilRes.ok,
      neo_ndvi: r.ndviRes.ok,
      fao_asi: r.asiRes.ok,
      hdx_acled: r.acledRes.ok,
      who_gho: r.whoRes.ok,
      world_bank: r.wbRes.ok,
      faostat: r.faostatRes.ok,
      ocha_fts: r.ftsRes.ok,
      usgs_earthquakes: r.usgsRes.ok,
      gdacs: r.gdacsRes.ok,
      gvp_volcanoes: r.gvpRes.ok,
      nasa_eonet: r.eonetRes.ok,
      open_meteo: r.openMeteoRes.ok,
    },
    notes: [
      r.oniRes.ok ? `ONI ${r.oniRes.value?.indicator.value} (${r.oniRes.ms}ms)` : `ONI failed: ${r.oniRes.error}`,
      r.soiRes.ok ? `SOI ${r.soiRes.value?.indicator.value} (${r.soiRes.ms}ms)` : `SOI failed: ${r.soiRes.error}`,
      r.tradeWindRes.ok ? `Trade-wind ${r.tradeWindRes.value?.indicator.value} (${r.tradeWindRes.ms}ms)` : `Trade-wind failed: ${r.tradeWindRes.error}`,
      r.nmmeRes.ok ? `NMME projected ONI ${r.nmmeRes.value?.ensemble_mean} (${r.nmmeRes.value?.target_window}, ${r.nmmeRes.value?.members.length} members, ${r.nmmeRes.ms}ms)` : `NMME failed: ${r.nmmeRes.error}`,
      r.rainfallRes.ok
        ? `Rainfall mean anom ${r.rainfallRes.value?.indicator.value}% (${r.rainfallRes.value?.reporting_count}/${r.rainfallRes.value?.focus_count} provinces reporting, ${r.rainfallRes.value?.raw_count} raw rows, ${r.rainfallRes.ms}ms)`
        : `Rainfall failed: ${r.rainfallRes.error}`,
      r.foodRes.ok ? `Food security: ${r.foodRes.value?.note}` : `Food security failed: ${r.foodRes.error}`,
      r.soilRes.ok
        ? `Soil moisture median ${r.soilRes.value?.indicator.value}th pctile (${r.soilRes.value?.per_province.length} provinces, ${r.soilRes.ms}ms)`
        : `Soil moisture failed: ${r.soilRes.error}`,
      r.ndviRes.ok ? `${r.ndviRes.value?.note} (${r.ndviRes.ms}ms)` : `NDVI failed: ${r.ndviRes.error}`,
      r.asiRes.ok ? `${r.asiRes.value?.note} (${r.asiRes.ms}ms)` : `FAO ASI failed: ${r.asiRes.error}`,
      r.acledRes.ok ? `ACLED: ${r.acledRes.value?.note}` : `ACLED failed: ${r.acledRes.error}`,
      r.whoRes.ok ? `WHO GHO: ${r.whoRes.value?.note} (${r.whoRes.ms}ms)` : `WHO GHO failed: ${r.whoRes.error}`,
      r.wbRes.ok ? `World Bank: ${r.wbRes.value?.note} (${r.wbRes.ms}ms)` : `World Bank failed: ${r.wbRes.error}`,
      r.faostatRes.ok ? `FAOSTAT: ${r.faostatRes.value?.note} (${r.faostatRes.ms}ms)` : `FAOSTAT failed: ${r.faostatRes.error}`,
      r.ftsRes.ok ? `OCHA FTS: ${r.ftsRes.value?.note} (${r.ftsRes.ms}ms)` : `OCHA FTS failed: ${r.ftsRes.error}`,
      r.usgsRes.ok ? `USGS: ${r.usgsRes.value?.note} (${r.usgsRes.ms}ms)` : `USGS failed: ${r.usgsRes.error}`,
      r.gdacsRes.ok ? `GDACS: ${r.gdacsRes.value?.note} (${r.gdacsRes.ms}ms)` : `GDACS failed: ${r.gdacsRes.error}`,
      r.gvpRes.ok ? `GVP volcanoes: ${r.gvpRes.value?.note} (${r.gvpRes.ms}ms)` : `GVP volcanoes failed: ${r.gvpRes.error}`,
      r.eonetRes.ok ? `NASA EONET: ${r.eonetRes.value?.note} (${r.eonetRes.ms}ms)` : `NASA EONET failed: ${r.eonetRes.error}`,
      r.openMeteoRes.ok ? `Open-Meteo: ${r.openMeteoRes.value?.note} (${r.openMeteoRes.ms}ms)` : `Open-Meteo failed: ${r.openMeteoRes.error}`,
    ].join(" | "),
  };
  await writeJson("last_run.json", lastRun);
  return lastRun;
}
