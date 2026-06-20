/**
 * FAOSTAT (FAO Statistics) — Food Security historical baseline.
 *
 * FAOSTAT's REST API is fully keyless and returns PNG national food-security
 * time series as JSON. We pull the Food Security (domain "FS") indicator:
 *   - Prevalence of undernourishment (item 21004) — the Food Security STANDING
 *     FLOOR. This is the share of PNG's population chronically without enough
 *     dietary energy: the baseline hunger an ENSO drought shock lands ON TOP of.
 *     A province sitting on a high undernourishment floor has far less slack to
 *     absorb a failed garden season, so this number frames every Food Security
 *     reading. Higher prevalence = worse. FAO publishes it as a 3-year rolling
 *     mean (e.g. "2020-2022"), which is why it lags and moves slowly.
 *
 * FAOSTAT reports nationally (no PNG admin-1 food-security series here), so —
 * exactly like the World Bank / WHO GHO national-signal pattern — we apply the
 * one national figure uniformly to the focus provinces and SAY SO in the caption.
 * Honest national-derived baseline, not a faked per-province measurement.
 *
 * This is a SLOW STRUCTURAL BASELINE, not an ENSO alert driver — the indicator
 * key (FOOD_UNDERNOURISH) is excluded from the national alert rollup via
 * NON_ALERT_KEYS, the same treatment as malaria incidence and CPI inflation.
 *
 * Endpoint (FAOSTAT REST, fenixservices mirror):
 *   https://fenixservices.fao.org/faostat/api/v1/en/data/FS
 *     ?area=196        (Papua New Guinea, M49 area code)
 *     &item=21004      (Prevalence of undernourishment)
 *     &element=6121    (Value, %, 3-year average)
 *     &output_type=objects
 */
import type { Indicator, SectorRisk } from "../../src/lib/types";

const FAOSTAT_BASE = "https://fenixservices.fao.org/faostat/api/v1/en/data/FS";
const PNG_AREA = "196"; // M49 code for Papua New Guinea
const UNDERNOURISH_ITEM = "21004"; // Prevalence of undernourishment
const VALUE_ELEMENT = "6121"; // Value (%, 3-year average)

interface FaostatRow {
  Year: string; // e.g. "2020-2022" (3-year window) or "2022"
  Value: number | string | null;
  Unit?: string;
  Item?: string;
}

interface FaostatBody {
  data?: FaostatRow[];
}

/**
 * Prevalence of undernourishment (%) → Food Security level. FAO reports PNG in a
 * persistently elevated band; we calibrate against that so the chronic floor
 * reads "med" (watch), not a permanent "critical" that would pin every province:
 *   <10% low · 10–25% standing food-insecurity floor (watch) · 25–40% high ·
 *   >40% critical (acute structural hunger).
 */
function classifyUndernourishment(pct: number): SectorRisk["level"] {
  if (pct >= 40) return "critical";
  if (pct >= 25) return "high";
  if (pct >= 10) return "med";
  return "low";
}

/** Parse FAOSTAT's Year field ("2020-2022" → end year 2022; "2022" → 2022). */
function endYear(year: string): number {
  const parts = year.split("-");
  const last = parts[parts.length - 1];
  return Number(last);
}

async function fetchSeries(): Promise<FaostatRow[]> {
  const url =
    `${FAOSTAT_BASE}?area=${PNG_AREA}&item=${UNDERNOURISH_ITEM}` +
    `&element=${VALUE_ELEMENT}&output_type=objects`;
  const res = await fetch(url, {
    headers: { "user-agent": "newcis-ingest/0.1", accept: "application/json" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`FAOSTAT FS: HTTP ${res.status}`);
  const body = (await res.json()) as FaostatBody;
  return body.data ?? [];
}

/** Latest numeric row by end-year. */
function latestNumeric(rows: FaostatRow[]): { value: number; year: string } | null {
  const usable = rows
    .map((r) => ({ raw: r, num: typeof r.Value === "string" ? Number(r.Value) : r.Value }))
    .filter((r) => r.num !== null && Number.isFinite(r.num as number))
    .sort((a, b) => endYear(a.raw.Year) - endYear(b.raw.Year));
  if (usable.length === 0) return null;
  const top = usable[usable.length - 1];
  return { value: top.num as number, year: top.raw.Year };
}

export interface FaostatResult {
  indicator: Indicator;
  sector_rows: SectorRisk[];
  undernourish_pct: number;
  undernourish_window: string;
  note: string;
}

export async function fetchFaostat(focusCodes: string[]): Promise<FaostatResult> {
  const rows = await fetchSeries();
  const latest = latestNumeric(rows);
  if (!latest) {
    throw new Error("FAOSTAT FS: no numeric undernourishment row for PNG");
  }
  const pct = latest.value;
  const window = latest.year;

  // Stamp the reading at the end of the window's final year — the data's own date.
  const observedAt = new Date(Date.UTC(endYear(window), 11, 31)).toISOString();
  const level = classifyUndernourishment(pct);
  // Score within 0..1, anchored so the critical band (≥40%) saturates near 1.
  const score = Math.min(1, Math.max(0, pct) / 50);

  const indicator: Indicator = {
    key: "FOOD_UNDERNOURISH",
    label: "Prevalence of undernourishment",
    unit: "% of population",
    source: "FAOSTAT (FAO Food Security)",
    update_frequency: "annual",
    provenance: "LIVE",
    value: pct,
    observed_at: observedAt,
    trend: "flat", // computed by the orchestrator against readings_history
  };

  const caption = `FAOSTAT · undernourishment ${pct.toFixed(1)}% (${window}, national 3-yr mean)`;

  const sector_rows: SectorRisk[] = focusCodes.map((code) => ({
    province_code: code,
    sector: "Food Security",
    level,
    score,
    trend: "flat",
    provenance: "LIVE",
    as_of: observedAt,
    data_source: caption,
  }));

  return {
    indicator,
    sector_rows,
    undernourish_pct: pct,
    undernourish_window: window,
    note: `FAOSTAT ${window}: undernourishment ${pct.toFixed(1)}% → ${level} Food Security floor (national, applied to ${focusCodes.length} focus provinces)`,
  };
}

// CLI smoke test: `pnpm tsx ingest/sources/faostat.ts`
if (process.argv[1] && process.argv[1].endsWith("faostat.ts")) {
  fetchFaostat(["PG07", "PG10", "PG11", "PG08"]).then(
    (r) => console.log(JSON.stringify(r, null, 2)),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
