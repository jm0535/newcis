/**
 * Risk engine. Pure, deterministic, no I/O — give it data, get risk back.
 *
 * Three entry points:
 *   - classifyIndicator(value, threshold)  → AlertLevel for a single climate indicator
 *   - scoreSector(province, sector, ctx)   → SectorRisk for one (province, sector) cell
 *   - rollUpNational(indicators, sectors)  → NationalStatus
 *
 * All band edges live in risk_thresholds.json. The engine never hard-codes numbers.
 * Missing inputs degrade to "low" / "GREEN" with a flat trend — never throw.
 */
import type {
  AlertLevel,
  HistoricalReading,
  Indicator,
  NationalStatus,
  RiskLevel,
  RiskThreshold,
  Sector,
  SectorRisk,
  Trend,
} from "./types";

// ---------- indicator → alert level ----------

/**
 * Map a raw indicator value to GREEN/AMBER/RED/BLACK using its threshold row.
 *
 * Non-inverted + symmetric (default, e.g. ONI, SST): ENSO is two-sided — both a
 * very positive (El Niño) AND a very negative (La Niña) anomaly are hazards, so
 * we compare |value| to the bands.
 *
 * Non-inverted + symmetric:false (e.g. SEISMIC event counts): one-sided — the
 * value only escalates as it RISES and can never be negative, so we compare the
 * raw value (no absolute value, which would invent phantom negative hazards).
 *
 * Inverted (e.g. RAINFALL_ANOM, SOI, NDVI, SOIL_MOISTURE): more negative / lower
 * = worse. Bands in the file are written as the *worse* direction (e.g. rainfall
 * green_max = -20), so we escalate when value ≤ band.
 */
export function classifyIndicator(
  value: number | null,
  threshold: RiskThreshold | undefined,
): AlertLevel {
  if (value === null || !threshold) return "GREEN";

  if (threshold.inverted) {
    if (value <= threshold.red_max) return "BLACK";
    if (value <= threshold.amber_max) return "RED";
    if (value <= threshold.green_max) return "AMBER";
    return "GREEN";
  }

  // Symmetric unless explicitly flagged one-sided. Symmetric metrics use |value|
  // (La Niña is as dangerous as El Niño); one-sided metrics use the raw value.
  const v = threshold.symmetric === false ? value : Math.abs(value);
  if (v > threshold.red_max) return "BLACK";
  if (v > threshold.amber_max) return "RED";
  if (v > threshold.green_max) return "AMBER";
  return "GREEN";
}

// ---------- sector risk ----------

const ALERT_TO_RISK: Record<AlertLevel, RiskLevel> = {
  GREEN: "low",
  AMBER: "med",
  RED: "high",
  BLACK: "critical",
};

const RISK_ORDER: RiskLevel[] = ["low", "med", "high", "critical"];

function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_ORDER.indexOf(a) >= RISK_ORDER.indexOf(b) ? a : b;
}

const ALERT_ORDER: AlertLevel[] = ["GREEN", "AMBER", "RED", "BLACK"];
function maxAlert(a: AlertLevel, b: AlertLevel): AlertLevel {
  return ALERT_ORDER.indexOf(a) >= ALERT_ORDER.indexOf(b) ? a : b;
}

/**
 * Which indicators feed which sector. Province-agnostic — the engine combines the
 * worst national indicator level with any province-specific sector data (e.g.
 * rainfall_anom for Water Security at a specific province) to produce the cell.
 *
 * Keep this map small and explainable. "Why is Enga red?" should reduce to one
 * climate driver + one local datum.
 */
const SECTOR_DRIVERS: Record<Sector, string[]> = {
  "Water Security": ["RAINFALL_ANOM", "SOIL_MOISTURE"],
  "Food Security": ["RAINFALL_ANOM", "NDVI", "SOIL_MOISTURE"],
  "Public Health": ["TEMP_ANOM", "RAINFALL_ANOM"],
  "Economic Stability": ["ONI"],
  // Seismic is intentionally NOT a national indicator driver here. The national
  // SEISMIC count would apply uniformly to every province (the replication the
  // spatial join exists to avoid); instead the per-province USGS row (epicentres
  // attributed by point-in-polygon) max-merges in via provinceSectorRow, so a
  // province escalates only where quakes actually struck. RAINFALL_ANOM remains
  // a province-level rainfall driver for flood/landslide infrastructure stress.
  Infrastructure: ["RAINFALL_ANOM"],
  "Energy Security": ["RAINFALL_ANOM"],
  "Social Stability": ["ONI"],
  // Multi-hazard sector. No national indicator driver: both signals are already
  // province-attributed upstream — per-province USGS seismic rows and the GDACS
  // alert overlay — and max-merge in via provinceSectorRow. Keeping SEISMIC here
  // would re-impose a uniform national floor on every province.
  "Disaster & Hazard": [],
};

export interface SectorContext {
  indicators: Indicator[];
  thresholds: RiskThreshold[];
  /** Pre-existing province-specific sector rows (e.g. rainfall-derived from HDX). */
  provinceSectorRow?: SectorRisk;
}

/**
 * Combine national indicators + any province-specific row into one SectorRisk cell.
 * Returns the worst risk across drivers — explainable, no opaque weighting.
 */
export function scoreSector(
  provinceCode: string,
  sector: Sector,
  ctx: SectorContext,
): SectorRisk {
  const drivers = SECTOR_DRIVERS[sector] ?? [];
  const thresholdByKey = new Map(ctx.thresholds.map((t) => [t.metric, t]));
  const indicatorByKey = new Map(ctx.indicators.map((i) => [i.key, i]));

  let worst: AlertLevel = "GREEN";
  let worstSource = "indicators";
  for (const key of drivers) {
    const ind = indicatorByKey.get(key);
    if (!ind) continue;
    const level = classifyIndicator(ind.value, thresholdByKey.get(key));
    if (ALERT_ORDER.indexOf(level) > ALERT_ORDER.indexOf(worst)) {
      worst = level;
      worstSource = ind.source;
    }
  }

  let level = ALERT_TO_RISK[worst];
  let score = ALERT_ORDER.indexOf(worst) / 3; // 0..1
  let trend: Trend = "flat";
  let provenance = ctx.provinceSectorRow?.provenance ?? "DEMO";
  let dataSource = ctx.provinceSectorRow?.data_source ?? worstSource;

  if (ctx.provinceSectorRow) {
    level = maxRisk(level, ctx.provinceSectorRow.level);
    score = Math.max(score, ctx.provinceSectorRow.score);
    trend = ctx.provinceSectorRow.trend;
    provenance = ctx.provinceSectorRow.provenance;
  }

  return {
    province_code: provinceCode,
    sector,
    level,
    score,
    trend,
    provenance,
    as_of: new Date().toISOString(),
    data_source: dataSource,
  };
}

// ---------- national rollup ----------

/**
 * Derive the national status object from per-indicator + per-sector results.
 * ONI is the primary ENSO phase driver; alert_level is the worst across all
 * indicators; national_risk_rating reflects how many focus provinces are in trouble.
 */
export function rollUpNational(
  indicators: Indicator[],
  thresholds: RiskThreshold[],
  sectorRisks: SectorRisk[],
  focusCodes: string[],
  forecastPeriod = "Next 3 months",
  /**
   * Province population by p-code (from provinces.geojson). When supplied,
   * affected_population_est is the summed population of provinces that have ANY
   * sector at high/critical — a real, traceable figure rather than a guess. When
   * absent (e.g. a unit test with no geojson) it stays 0 and the UI shows "—".
   */
  populationByCode?: Record<string, number>,
): NationalStatus {
  const thresholdByKey = new Map(thresholds.map((t) => [t.metric, t]));

  let worstAlert: AlertLevel = "GREEN";
  for (const ind of indicators) {
    worstAlert = maxAlert(worstAlert, classifyIndicator(ind.value, thresholdByKey.get(ind.key)));
  }

  // ENSO phase reads its band edges from the ONI threshold row, so the gauge
  // colour and the phase label can never disagree: watch starts at the AMBER
  // edge (green_max), alert at the RED edge (amber_max). Symmetric for La Niña.
  const oni = indicators.find((i) => i.key === "ONI")?.value ?? null;
  const oniBand = thresholdByKey.get("ONI");
  const watchEdge = oniBand?.green_max ?? 0.5; // first escalation (AMBER)
  const alertEdge = oniBand?.amber_max ?? 1.0; // alert tier (RED)
  const ensoPhase: NationalStatus["enso_phase"] =
    oni === null
      ? "neutral"
      : oni >= alertEdge
        ? "el_nino_alert"
        : oni >= watchEdge
          ? "el_nino_watch"
          : oni <= -alertEdge
            ? "la_nina_alert"
            : oni <= -watchEdge
              ? "la_nina_watch"
              : "neutral";

  const focusSet = new Set(focusCodes);
  const highRiskProvinces = new Set(
    sectorRisks
      .filter(
        (r) => focusSet.has(r.province_code) && (r.level === "high" || r.level === "critical"),
      )
      .map((r) => r.province_code),
  );

  const rating: RiskLevel =
    highRiskProvinces.size >= focusCodes.length / 2
      ? "high"
      : highRiskProvinces.size >= 1
        ? "med"
        : "low";

  // Affected-population estimate: the summed population of every high/critical
  // province, drawn from real provinces.geojson figures. Provinces with no
  // population entry contribute 0 rather than a fabricated number.
  const affectedPopulation = populationByCode
    ? [...highRiskProvinces].reduce((sum, code) => sum + (populationByCode[code] ?? 0), 0)
    : 0;

  return {
    enso_phase: ensoPhase,
    alert_level: worstAlert,
    national_risk_rating: rating,
    affected_population_est: affectedPopulation,
    high_risk_province_count: highRiskProvinces.size,
    forecast_period: forecastPeriod,
    updated_at: new Date().toISOString(),
  };
}

// ---------- trend (re-exported for the orchestrator) ----------

export function computeTrend(
  key: string,
  newValue: number,
  history: HistoricalReading[],
  relativeDelta = 0.05,
  absoluteDelta = 0.05,
): Trend {
  const prior = history
    .filter((h) => h.key === key)
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
  if (!prior) return "flat";
  const delta = newValue - prior.value;
  const threshold = Math.max(absoluteDelta, Math.abs(prior.value) * relativeDelta);
  if (Math.abs(delta) < threshold) return "flat";
  return delta > 0 ? "up" : "down";
}
