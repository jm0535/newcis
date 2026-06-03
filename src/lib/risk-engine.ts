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
 * Non-inverted (e.g. ONI, SST): more positive = worse, but ENSO is symmetric — La Niña
 * (very negative ONI) is also a hazard. So we compare |value| to the bands.
 *
 * Inverted (e.g. RAINFALL_ANOM, SOI, NDVI, SOIL_MOISTURE): more negative / lower = worse.
 * Bands in the file are written as the *worse* direction (e.g. rainfall green_max = -20),
 * so we escalate when value ≤ band.
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

  const v = Math.abs(value);
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
  Infrastructure: ["RAINFALL_ANOM"],
  "Energy Security": ["RAINFALL_ANOM"],
  "Social Stability": ["ONI"],
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
): NationalStatus {
  const thresholdByKey = new Map(thresholds.map((t) => [t.metric, t]));

  let worstAlert: AlertLevel = "GREEN";
  for (const ind of indicators) {
    worstAlert = maxAlert(worstAlert, classifyIndicator(ind.value, thresholdByKey.get(ind.key)));
  }

  const oni = indicators.find((i) => i.key === "ONI")?.value ?? null;
  const ensoPhase: NationalStatus["enso_phase"] =
    oni === null
      ? "neutral"
      : oni > 1.0
        ? "el_nino_alert"
        : oni > 0.5
          ? "el_nino_watch"
          : oni < -1.0
            ? "la_nina_alert"
            : oni < -0.5
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

  return {
    enso_phase: ensoPhase,
    alert_level: worstAlert,
    national_risk_rating: rating,
    affected_population_est: 0, // populated when /public/provinces.geojson is joined upstream
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
