/**
 * FAO GIEWS Earth Observation — Agricultural Stress Index (ASI), per province.
 *
 * ASI is FAO's operational agricultural-drought index: the PERCENT of a
 * province's cropland where the season's Mean Vegetation Health Index fell below
 * 35 (the FAO drought threshold). High ASI = a large share of crops under stress
 * = the leading edge of a food-security shock. It is the agronomic complement to
 * our raw NDVI anomaly: NDVI says "vegetation is below normal", ASI says "and
 * here is how much of the actual CROPPED area that hits" — exactly the signal an
 * ENSO drought early-warning needs.
 *
 * SOURCE — why this one: FAO is the only global provider giving PNG data at the
 * PROVINCE (admin-1) level, and it is keyless. GIEWS publishes a per-country CSV
 * of the dekadal (10-day) ASI time series, one row per province per dekad, back
 * to 1984:
 *   https://www.fao.org/giews/earthobservation/asis/data/country/PNG/MAP_ASI/DATA/ASI_Dekad_Season1_data.csv
 * Columns: Indicator,Country,ADM1_CODE,Province,Land_Type,Date,Data,Year,Month,
 * Dekad,Unit,Source. We take the latest published dekad, map each GIEWS province
 * NAME to our p-code (GIEWS uses its own numeric ADM1_CODE and pre-2012 borders),
 * and emit a national ASI gauge (mean of focus provinces) plus per-province Food
 * Security rows. LIVE — a genuine FAO feed pulled fresh each cycle.
 *
 * Border caveat (handled honestly): GIEWS predates the 2012 creation of Hela and
 * Jiwaka, so those two still sit inside Southern Highlands / Western Highlands in
 * GIEWS. We attribute each split province its parent region's ASI and SAY SO in
 * the row's data_source — same physiographic highland, no fabricated precision.
 */
import type { Indicator, SectorRisk } from "../../src/lib/types";
import { FOCUS_PROVINCES } from "../../src/lib/focus-provinces";

const ASI_DEKAD_CSV =
  "https://www.fao.org/giews/earthobservation/asis/data/country/PNG/MAP_ASI/DATA/ASI_Dekad_Season1_data.csv";

// GIEWS province NAME → our p-code. GIEWS uses its own admin set with a few
// historical names (Northern = Oro, Northern Solomons = Bougainville) and the
// pre-2012 highland borders (no Hela/Jiwaka). Keyed on the GIEWS `Province`
// string exactly as it appears in the CSV.
const GIEWS_NAME_TO_CODE: Record<string, string> = {
  "Central": "PG03",
  "Chimbu": "PG10",
  "East New Britain": "PG18",
  "East Sepik": "PG14",
  "Eastern Highlands": "PG11",
  "Enga": "PG08",
  "Gulf": "PG02",
  "Madang": "PG13",
  "Manus": "PG16",
  "Milne Bay": "PG05",
  "Morobe": "PG12",
  "National Capital District": "PG04",
  "New Ireland": "PG17",
  "Northern": "PG06", // GIEWS "Northern" = Oro Province
  "Northern Solomons": "PG20", // = Autonomous Region of Bougainville
  "Southern Highlands": "PG07",
  "West New Britain": "PG19",
  "West Sepik": "PG15",
  "Western": "PG01",
  "Western Highlands": "PG09",
};

// Split-province inheritance: provinces carved out AFTER the GIEWS admin set was
// fixed inherit their parent region's ASI (same highland, no separate FAO series).
// child p-code → parent GIEWS province name.
const SPLIT_INHERIT: Record<string, string> = {
  PG21: "Southern Highlands", // Hela, split from Southern Highlands (2012)
  PG22: "Western Highlands", // Jiwaka, split from Western Highlands (2012)
};

const FOCUS_CODE_SET = new Set(FOCUS_PROVINCES.map((p) => p.code));

interface DekadRow {
  code: string; // our p-code
  province: string; // GIEWS name
  asi: number; // % cropland with Mean VHI < 35
  date: string; // YYYY-MM-DD (dekad start)
  inherited?: string; // parent GIEWS name when this is a split-province fill
}

// ASI (% stressed cropland) → Food Security risk level. Drought-stress bands:
// FAO treats sustained ASI > ~30% as a serious agricultural drought; we map a
// conservative four-band scale so a worsening dry season escalates the cell.
function classifyAsi(asi: number): SectorRisk["level"] {
  if (asi >= 50) return "critical";
  if (asi >= 30) return "high";
  if (asi >= 15) return "med";
  return "low";
}

// Minimal CSV split: GIEWS ASI fields are plain (no embedded commas/quotes), so a
// straight split is safe and avoids a parser dependency.
function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(",").map((c) => c.trim()));
}

export interface FaoAsiResult {
  indicator: Indicator;
  sector_rows: SectorRisk[];
  per_province: DekadRow[];
  latest_dekad: string;
  note: string;
}

export async function fetchFaoAsi(): Promise<FaoAsiResult> {
  const res = await fetch(ASI_DEKAD_CSV, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`FAO ASI: HTTP ${res.status}`);
  const rows = parseCsv(await res.text());
  const header = rows[0];
  const idx = (name: string) => header.indexOf(name);
  const cProvince = idx("Province");
  const cData = idx("Data");
  const cDate = idx("Date");
  if (cProvince < 0 || cData < 0 || cDate < 0) {
    throw new Error("FAO ASI: unexpected CSV header");
  }

  // Find the latest dekad present in the file, then keep only that dekad's rows.
  let latest = "";
  for (let i = 1; i < rows.length; i++) {
    const d = rows[i][cDate];
    if (d && d > latest) latest = d;
  }
  if (!latest) throw new Error("FAO ASI: no dated rows");

  // GIEWS province name → ASI value at the latest dekad.
  const asiByGiewsName = new Map<string, number>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r[cDate] !== latest) continue;
    const v = Number(r[cData]);
    if (Number.isFinite(v)) asiByGiewsName.set(r[cProvince], v);
  }
  if (asiByGiewsName.size === 0) {
    throw new Error("FAO ASI: latest dekad has no valid values");
  }

  // Build per-province rows for every focus province we can map (direct +
  // split-inheritance). Provinces GIEWS does not cover are simply absent — the
  // engine fills those cells from other sources / seed, never blanked.
  const perProvince: DekadRow[] = [];
  for (const [giewsName, asi] of asiByGiewsName) {
    const code = GIEWS_NAME_TO_CODE[giewsName];
    if (code && FOCUS_CODE_SET.has(code)) {
      perProvince.push({ code, province: giewsName, asi, date: latest });
    }
  }
  // Split provinces inherit the parent region's ASI.
  for (const [childCode, parentName] of Object.entries(SPLIT_INHERIT)) {
    if (!FOCUS_CODE_SET.has(childCode)) continue;
    const asi = asiByGiewsName.get(parentName);
    if (asi === undefined) continue;
    perProvince.push({
      code: childCode,
      province: parentName,
      asi,
      date: latest,
      inherited: parentName,
    });
  }
  if (perProvince.length === 0) {
    throw new Error("FAO ASI: no focus province mapped from GIEWS data");
  }

  // National gauge = MEAN focus-province ASI. ASI is a bounded percentage, so the
  // mean is the right national summary — a broad drought lifts the mean across
  // provinces. Rounded to one decimal (the source publishes 3dp; 1dp reads).
  const nationalAsi =
    Math.round(
      (perProvince.reduce((a, r) => a + r.asi, 0) / perProvince.length) * 10,
    ) / 10;

  const indicator: Indicator = {
    key: "ASI",
    label: `Agricultural stress (mean of ${perProvince.length} of ${FOCUS_PROVINCES.length} provinces)`,
    unit: "% of cropland with Mean VHI below 35",
    source: "FAO GIEWS · ASIS (Agricultural Stress Index)",
    update_frequency: "dekadal (10-day)",
    provenance: "LIVE",
    value: nationalAsi,
    observed_at: latest,
    trend: "flat", // computed by the orchestrator against readings_history
  };

  // Per-province Food Security rows. ASI is a direct cropland-drought measure, so
  // it feeds Food Security; the engine max-merges it against NDVI / rainfall /
  // soil so the worst signal wins the cell.
  const sector_rows: SectorRisk[] = perProvince.map((r) => ({
    province_code: r.code,
    sector: "Food Security",
    level: classifyAsi(r.asi),
    // Score grows with stressed-cropland share; 50% saturates the scale (the
    // BLACK band edge), matching classifyAsi's critical threshold.
    score: Math.min(Math.max(r.asi / 50, 0), 1),
    trend: "flat",
    provenance: "LIVE",
    as_of: new Date().toISOString(),
    data_source: r.inherited
      ? `FAO GIEWS ASI ${r.asi}% (inherited from ${r.inherited}, pre-2012 border)`
      : `FAO GIEWS ASI ${r.asi}% cropland stressed`,
  }));

  const stressed = perProvince.filter((r) => r.asi >= 15).length;
  const note = `FAO ASI ${latest}: national mean ${nationalAsi}% stressed cropland; ${perProvince.length}/${FOCUS_PROVINCES.length} provinces mapped, ${stressed} elevated`;

  return {
    indicator,
    sector_rows,
    per_province: perProvince,
    latest_dekad: latest,
    note,
  };
}
