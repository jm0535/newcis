/**
 * NASA NEO — MODIS/Terra monthly NDVI (MOD_NDVI_M) vegetation health.
 *
 * NDVI (Normalized Difference Vegetation Index, 0..1) is the standard satellite
 * measure of vegetation vigour: dense, healthy canopy reads high (~0.8 over PNG
 * rainforest), bare/stressed land reads low. Drought stress shows up in NDVI
 * about 4–8 weeks after the rainfall deficit, which makes a NEGATIVE NDVI anomaly
 * an early canary for highland food-security collapse — exactly the lead signal
 * the concept calls for.
 *
 * SOURCE — why this one: there is no clean keyless NASA NDVI *point* API (MODIS
 * granules need Earthdata auth). NASA's "Earth Observations" (NEO) portal,
 * however, publishes each monthly visualisation as a plain global CSV grid with
 * no key and no login:
 *   https://neo.gsfc.nasa.gov/archive/csv/MOD_NDVI_M/MOD_NDVI_M_YYYY-MM.CSV.gz
 * The grid is 3600×1800 at 0.1° (row 0 = 90°N, col 0 = 180°W), nodata = 99999.
 * We pull the latest available month plus the SAME calendar month in the prior
 * few years, sample each focus-province interior point, and report the seasonal
 * anomaly (latest − same-month multi-year mean). A same-month baseline is the
 * right comparison for the tropics, where NDVI has a strong seasonal cycle — a
 * raw month-on-month delta would just measure the season, not the stress.
 *
 * The production system can swap this for the full MOD13A3 raster via Earthdata;
 * the anomaly logic and threshold bands (risk_thresholds.json NDVI) are unchanged.
 */
import { gunzipSync } from "node:zlib";
import type { Indicator, SectorRisk } from "../../src/lib/types";
import { FOCUS_PROVINCES } from "../../src/lib/focus-provinces";

const NEO_BASE = "https://neo.gsfc.nasa.gov/archive/csv/MOD_NDVI_M";
const NODATA = 99999;
const NCOLS = 3600;
const NROWS = 1800;
const STEP = 0.1; // degrees per cell

// How many prior years (same calendar month) form the seasonal baseline, and how
// many months back we probe for the latest published grid (MODIS monthly lags by
// 1–2 months; we look back up to 4 to be safe).
const BASELINE_YEARS = 5;
const MAX_LOOKBACK_MONTHS = 4;

type Grid = Float64Array; // length NROWS*NCOLS, NODATA preserved

function ym(year: number, month1: number): string {
  return `${year}-${String(month1).padStart(2, "0")}`;
}

async function fetchGrid(yyyymm: string): Promise<Grid | null> {
  const url = `${NEO_BASE}/MOD_NDVI_M_${yyyymm}.CSV.gz`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (res.status === 404) return null; // month not published yet
  if (!res.ok) throw new Error(`NEO NDVI ${yyyymm}: HTTP ${res.status}`);
  const gz = Buffer.from(await res.arrayBuffer());
  const csv = gunzipSync(gz).toString("utf8");
  const grid = new Float64Array(NROWS * NCOLS);
  const lines = csv.split("\n");
  for (let r = 0; r < NROWS; r++) {
    const line = lines[r];
    if (!line) continue;
    const cols = line.split(",");
    for (let c = 0; c < NCOLS; c++) {
      const v = Number(cols[c]);
      grid[r * NCOLS + c] = Number.isFinite(v) ? v : NODATA;
    }
  }
  return grid;
}

/** Row/col for a lon/lat on the 0.1° grid (row 0 = 90°N, col 0 = 180°W). */
function rowCol(lon: number, lat: number): { row: number; col: number } {
  const row = Math.min(Math.max(Math.round((90 - lat) / STEP), 0), NROWS - 1);
  const col = Math.min(Math.max(Math.round((lon + 180) / STEP), 0), NCOLS - 1);
  return { row, col };
}

/**
 * Median of the valid (non-nodata, 0..1) cells in a (2k+1)² window around a
 * point. The window absorbs the coast: a province's interior point can land one
 * cell off the land mask, so we widen until we have land. Returns null if the
 * whole window is ocean/nodata.
 */
function sampleNDVI(grid: Grid, lon: number, lat: number, k = 1): number | null {
  const { row, col } = rowCol(lon, lat);
  const vals: number[] = [];
  for (let dr = -k; dr <= k; dr++) {
    for (let dc = -k; dc <= k; dc++) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= NROWS || c < 0 || c >= NCOLS) continue;
      const v = grid[r * NCOLS + c];
      if (v !== NODATA && v >= 0 && v <= 1) vals.push(v);
    }
  }
  if (vals.length === 0) return k < 3 ? sampleNDVI(grid, lon, lat, k + 1) : null;
  vals.sort((a, b) => a - b);
  return vals[Math.floor(vals.length / 2)];
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

interface ProvinceNdvi {
  code: string;
  name: string;
  latest: number;
  baseline: number;
  anomaly: number; // latest − baseline (negative = stressed)
}

// NDVI anomaly → Food Security risk level. Aligned with risk_thresholds.json
// NDVI bands (inverted: more negative = worse). Kept here as a local mirror so a
// per-province cell can be classified without importing the engine; the national
// indicator is classified by the engine against the same band file.
function classifyAnomaly(a: number): SectorRisk["level"] {
  if (a <= -0.2) return "critical";
  if (a <= -0.1) return "high";
  if (a <= -0.05) return "med";
  return "low";
}

export interface NeoNdviResult {
  indicator: Indicator;
  sector_rows: SectorRisk[];
  per_province: ProvinceNdvi[];
  latest_month: string;
  baseline_months: string[];
  note: string;
}

export async function fetchNeoNdvi(): Promise<NeoNdviResult> {
  // 1. Find the latest published month. Build the lookback candidates (most recent
  //    first), fetch them concurrently, and pick the most-recent one that resolved
  //    to a grid (non-null = published). Concurrent probe replaces the old serial
  //    step-back-until-first-hit loop; same result, no head-of-line latency.
  const now = new Date();
  const lookbackCandidates: string[] = [];
  let probeYear = now.getUTCFullYear();
  let probeMonth = now.getUTCMonth(); // 0-based; this is already "last month" as a 1-based index
  for (let i = 0; i < MAX_LOOKBACK_MONTHS; i++) {
    if (probeMonth === 0) {
      probeMonth = 12;
      probeYear -= 1;
    }
    lookbackCandidates.push(ym(probeYear, probeMonth)); // most-recent first
    probeMonth -= 1;
  }
  const lookbackGrids = await Promise.all(
    lookbackCandidates.map((m) => fetchGrid(m)),
  );
  let latestMonth: string | null = null;
  let latestGrid: Grid | null = null;
  for (let i = 0; i < lookbackCandidates.length; i++) {
    if (lookbackGrids[i]) {
      latestMonth = lookbackCandidates[i];
      latestGrid = lookbackGrids[i];
      break; // candidates are most-recent first
    }
  }
  if (!latestMonth || !latestGrid) {
    throw new Error("NEO NDVI: no published month found in lookback window");
  }

  const [latYearStr, latMonStr] = latestMonth.split("-");
  const latYear = Number(latYearStr);
  const latMon = Number(latMonStr);

  // 2. Same-calendar-month baseline grids for the prior BASELINE_YEARS years.
  //    Independent fetches — pulled concurrently; 404s drop out, preserving year
  //    order in the kept set.
  const baselineCandidates: string[] = [];
  for (let y = 1; y <= BASELINE_YEARS; y++) {
    baselineCandidates.push(ym(latYear - y, latMon));
  }
  const baselineFetched = await Promise.all(
    baselineCandidates.map((m) => fetchGrid(m)),
  );
  const baselineMonths: string[] = [];
  const baselineGrids: Grid[] = [];
  for (let i = 0; i < baselineCandidates.length; i++) {
    const grid = baselineFetched[i];
    if (grid) {
      baselineMonths.push(baselineCandidates[i]);
      baselineGrids.push(grid);
    }
  }
  if (baselineGrids.length === 0) {
    throw new Error("NEO NDVI: no baseline months available for anomaly");
  }

  // 3. Per-province anomaly: latest − mean(same-month baseline).
  const perProvince: ProvinceNdvi[] = [];
  for (const p of FOCUS_PROVINCES) {
    const latest = sampleNDVI(latestGrid, p.lon, p.lat);
    if (latest === null) continue; // no land cell — skip (rare; e.g. tiny atoll)
    const baseSamples = baselineGrids
      .map((g) => sampleNDVI(g, p.lon, p.lat))
      .filter((v): v is number => v !== null);
    if (baseSamples.length === 0) continue;
    const baseline = mean(baseSamples);
    perProvince.push({
      code: p.code,
      name: p.name,
      latest: Math.round(latest * 1000) / 1000,
      baseline: Math.round(baseline * 1000) / 1000,
      anomaly: Math.round((latest - baseline) * 1000) / 1000,
    });
  }
  if (perProvince.length === 0) {
    throw new Error("NEO NDVI: no province produced a valid anomaly");
  }

  // 4. National indicator = MEAN focus-province anomaly. NDVI anomaly is a signed
  //    continuous measure (not a bounded percentile), so the mean is the right
  //    national summary — a broad drying shows as a broadly negative mean.
  const nationalAnomaly =
    Math.round(mean(perProvince.map((r) => r.anomaly)) * 1000) / 1000;

  const indicator: Indicator = {
    key: "NDVI",
    label: `Vegetation health anomaly (mean of ${perProvince.length} of ${FOCUS_PROVINCES.length} provinces)`,
    unit: `NDVI anomaly vs same-month ${baselineMonths.length}-yr mean`,
    source: "NASA NEO · MODIS/Terra MOD_NDVI_M",
    update_frequency: "monthly",
    provenance: "LIVE",
    value: nationalAnomaly,
    observed_at: `${latestMonth}-01`,
    trend: "flat", // computed by the orchestrator against readings_history
  };

  // 5. Per-province Food Security rows. NDVI is the canonical vegetation driver
  //    for food security; the engine max-merges this against rainfall/soil so the
  //    worst signal wins the cell.
  const sector_rows: SectorRisk[] = perProvince.map((r) => ({
    province_code: r.code,
    sector: "Food Security",
    level: classifyAnomaly(r.anomaly),
    // Score grows as the anomaly turns negative; clamped to [0,1]. ~−0.3 anomaly
    // saturates the scale (catastrophic browning), matching the BLACK band depth.
    score: Math.min(Math.max(-r.anomaly / 0.3, 0), 1),
    trend: "flat",
    provenance: "LIVE",
    as_of: new Date().toISOString(),
    data_source: `NASA NEO MODIS NDVI · anomaly ${r.anomaly >= 0 ? "+" : ""}${r.anomaly}`,
  }));

  const stressed = perProvince.filter((r) => r.anomaly <= -0.05).length;
  const note = `NDVI ${latestMonth}: national anomaly ${nationalAnomaly >= 0 ? "+" : ""}${nationalAnomaly} vs ${baselineMonths.length}-yr same-month mean; ${perProvince.length}/${FOCUS_PROVINCES.length} provinces sampled, ${stressed} below normal`;

  return {
    indicator,
    sector_rows,
    per_province: perProvince,
    latest_month: latestMonth,
    baseline_months: baselineMonths,
    note,
  };
}
