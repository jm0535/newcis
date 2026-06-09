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
 * Graduated 0..1 score that orders cells WITHIN a band without ever crossing a
 * band boundary. Each band owns a fixed quarter of the range:
 *   GREEN [0,0.25)  AMBER [0.25,0.5)  RED [0.5,0.75)  BLACK [0.75,1]
 * The integer band always dominates (a RED cell outsorts every AMBER cell), and
 * `depth` (0..1, how far the value sits through its own band) breaks ties inside
 * a band — so two RED cells are distinguishable for sorting/ranking. This is a
 * SORT TIEBREAKER ONLY: the displayed level is unchanged (it's still the band).
 *
 * `depth` is computed from where the value falls between the band's lower and
 * upper edges; the open-ended top band (BLACK) saturates toward 1 by how far the
 * value exceeds its entry edge, capped so it stays inside the band's quarter.
 */
function bandedScore(value: number | null, threshold: RiskThreshold | undefined): number {
  const level = classifyIndicator(value, threshold);
  const base = ALERT_ORDER.indexOf(level) * 0.25;
  if (value === null || !threshold) return base; // GREEN floor, 0

  // Edges in escalation order: [entryToAMBER, entryToRED, entryToBLACK].
  // For inverted metrics the comparison value is the raw value and edges descend;
  // for symmetric metrics we use |value| and edges ascend. classifyIndicator
  // already encodes which; here we only need a monotonic position within a band.
  const edges = threshold.inverted
    ? [threshold.green_max, threshold.amber_max, threshold.red_max] // descending
    : [threshold.green_max, threshold.amber_max, threshold.red_max]; // ascending
  const v = threshold.inverted
    ? value
    : threshold.symmetric === false
      ? value
      : Math.abs(value);

  // Fractional position (0..1) of v across the band it landed in.
  let depth: number;
  const idx = ALERT_ORDER.indexOf(level); // 0..3
  if (threshold.inverted) {
    // Worse = lower. Band lower/upper edges in value terms (upper = less severe).
    if (idx === 0) depth = 0; // GREEN: above green_max, treat as band floor
    else if (idx === 1) depth = frac(v, edges[0], edges[1]); // AMBER between green&amber
    else if (idx === 2) depth = frac(v, edges[1], edges[2]); // RED between amber&red
    else depth = saturate(edges[2] - v, Math.abs(edges[2] - edges[1]) || 1); // BLACK below red
  } else {
    if (idx === 0) depth = frac(v, 0, edges[0]); // GREEN between 0 and green_max
    else if (idx === 1) depth = frac(v, edges[0], edges[1]);
    else if (idx === 2) depth = frac(v, edges[1], edges[2]);
    else depth = saturate(v - edges[2], Math.abs(edges[2] - edges[1]) || 1); // BLACK above red
  }
  // Keep strictly inside the quarter so a band ceiling never reaches the next
  // band's floor (0.999 of a quarter, not 1.0 of it).
  return base + Math.max(0, Math.min(0.999, depth)) * 0.25;
}

/** Fraction of x between lo and hi, clamped 0..1; direction-agnostic. */
function frac(x: number, lo: number, hi: number): number {
  if (hi === lo) return 0;
  return (x - lo) / (hi - lo);
}

/** Map a non-negative overflow to 0..1 via a soft saturation over one band width. */
function saturate(overflow: number, bandWidth: number): number {
  if (bandWidth <= 0) return overflow > 0 ? 0.999 : 0;
  return overflow / (overflow + bandWidth); // 0 at edge, →1 as overflow grows
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
  let worstValue: number | null = null;
  let worstThreshold: RiskThreshold | undefined;
  for (const key of drivers) {
    const ind = indicatorByKey.get(key);
    if (!ind) continue;
    const th = thresholdByKey.get(key);
    const level = classifyIndicator(ind.value, th);
    if (ALERT_ORDER.indexOf(level) > ALERT_ORDER.indexOf(worst)) {
      worst = level;
      worstSource = ind.source;
      worstValue = ind.value;
      worstThreshold = th;
    }
  }

  let level = ALERT_TO_RISK[worst];
  // Graduated within-band score (a sort tiebreaker; the level above is unchanged).
  // Falls back to the band floor when the worst driver has no usable threshold.
  let score = bandedScore(worstValue, worstThreshold);
  let trend: Trend = "flat";
  let provenance = ctx.provinceSectorRow?.provenance ?? "DEMO";
  let dataSource = ctx.provinceSectorRow?.data_source ?? worstSource;

  if (ctx.provinceSectorRow) {
    level = maxRisk(level, ctx.provinceSectorRow.level);
    score = Math.max(score, ctx.provinceSectorRow.score);
    trend = ctx.provinceSectorRow.trend;
    provenance = ctx.provinceSectorRow.provenance;
  }

  // Pin the final score into the resolved level's quarter so the invariant holds
  // after any max-merge with an upstream row (whose score may use a different
  // scale): the score's band ALWAYS equals the displayed level, and the fraction
  // within the quarter only breaks ties between same-level cells. This is what
  // keeps `score` a pure sort tiebreaker — it can never flip a sort across levels.
  score = pinScoreToLevel(score, level);

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

/**
 * Clamp a 0..1 score into the quarter owned by `level`, preserving its fractional
 * position within whatever quarter it came from. Keeps band(score) === level so
 * sorting by score never crosses a level boundary.
 */
function pinScoreToLevel(score: number, level: RiskLevel): number {
  const idx = RISK_ORDER.indexOf(level); // low..critical → 0..3
  const floor = idx * 0.25;
  const frac01 = ((score % 0.25) + 0.25) % 0.25 / 0.25; // fractional part of its own quarter
  return floor + Math.max(0, Math.min(0.999, frac01)) * 0.25;
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
