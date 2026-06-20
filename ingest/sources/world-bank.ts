/**
 * World Bank Open Data — Economic Stability baseline.
 *
 * The World Bank Indicators API is fully keyless and returns PNG national time
 * series as JSON. We pull three series:
 *   - FP.CPI.TOTL.ZG  (consumer-price inflation, annual %) — the Economic
 *     Stability RISK DRIVER. ENSO drought hits PNG through food and fuel prices:
 *     failed gardens and disrupted supply push the cost of living up, which is
 *     what an executive feels as "economic stress". Higher inflation = worse.
 *   - NY.GDP.MKTP.KD.ZG (real GDP growth, annual %) — CONTEXT. A growing economy
 *     absorbs a price shock better than a contracting one; carried in the caption.
 *   - SN.ITK.DEFC.ZS (prevalence of undernourishment, %) — CONTEXT. The standing
 *     food-insecurity floor the shock lands on; caption only.
 *
 * World Bank reports nationally (no PNG admin-1 economic series here), so — like
 * the ACLED / WHO GHO national-signal pattern — we apply the one national
 * inflation figure uniformly to the focus provinces and SAY SO in the caption.
 * Honest national-derived baseline, not a faked per-province measurement. These
 * series are annual and lag ~1–2 years, which the gauge age surfaces honestly.
 *
 * Endpoint:
 *   https://api.worldbank.org/v2/country/PNG/indicator/{CODE}?format=json&mrnev=1
 *   (mrnev=1 = "most recent non-empty value" — skips the trailing null years)
 */
import type { Indicator, SectorRisk } from "../../src/lib/types";

const WB_BASE = "https://api.worldbank.org/v2/country/PNG/indicator";
const INFLATION_CODE = "FP.CPI.TOTL.ZG";
const GDP_GROWTH_CODE = "NY.GDP.MKTP.KD.ZG";
const UNDERNOURISH_CODE = "SN.ITK.DEFC.ZS";

interface WbPoint {
  date: string;
  value: number | null;
}

/**
 * Annual CPI inflation (%) → Economic Stability level. PNG inflation has run low
 * single digits in calm years; a drought-driven food-price spike pushes it up.
 *   <5% routine · 5–10% elevated · 10–20% high · >20% critical (crisis inflation).
 */
function classifyInflation(inflationPct: number): SectorRisk["level"] {
  if (inflationPct >= 20) return "critical";
  if (inflationPct >= 10) return "high";
  if (inflationPct >= 5) return "med";
  return "low";
}

async function fetchLatest(code: string): Promise<WbPoint | null> {
  const url = `${WB_BASE}/${code}?format=json&mrnev=1`;
  const res = await fetch(url, {
    headers: { "user-agent": "newcis-ingest/0.1", accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`World Bank ${code}: HTTP ${res.status}`);
  const body = (await res.json()) as [unknown, WbPoint[] | null];
  const series = Array.isArray(body) ? body[1] : null;
  if (!series || series.length === 0) return null;
  const point = series.find((p) => p.value !== null);
  return point ?? null;
}

export interface WorldBankResult {
  indicator: Indicator;
  sector_rows: SectorRisk[];
  inflation_pct: number;
  inflation_year: string;
  gdp_growth_pct: number | null;
  undernourish_pct: number | null;
  note: string;
}

export async function fetchWorldBank(focusCodes: string[]): Promise<WorldBankResult> {
  const [inflation, gdp, undernourish] = await Promise.all([
    fetchLatest(INFLATION_CODE),
    fetchLatest(GDP_GROWTH_CODE),
    fetchLatest(UNDERNOURISH_CODE),
  ]);

  if (!inflation || inflation.value === null) {
    throw new Error("World Bank: no numeric inflation value for PNG");
  }
  const inflationPct = inflation.value;
  const inflationYear = inflation.date;

  const observedAt = new Date(Date.UTC(Number(inflationYear), 11, 31)).toISOString();
  const level = classifyInflation(inflationPct);
  // Score within 0..1, anchored so the critical band (≥20%) saturates near 1.
  const score = Math.min(1, Math.max(0, inflationPct) / 25);

  const indicator: Indicator = {
    key: "CPI_INFLATION",
    label: "Consumer-price inflation",
    unit: "annual %",
    source: "World Bank Open Data",
    update_frequency: "annual",
    provenance: "LIVE",
    value: inflationPct,
    observed_at: observedAt,
    trend: "flat", // computed by the orchestrator against readings_history
  };

  const gdpCtx =
    gdp?.value != null ? `; GDP growth ${gdp.value.toFixed(1)}% (${gdp.date})` : "";
  const underCtx =
    undernourish?.value != null
      ? `; undernourishment ${undernourish.value.toFixed(1)}% (${undernourish.date})`
      : "";
  const caption = `World Bank · inflation ${inflationPct.toFixed(1)}% (${inflationYear}, national)${gdpCtx}${underCtx}`;

  const sector_rows: SectorRisk[] = focusCodes.map((code) => ({
    province_code: code,
    sector: "Economic Stability",
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
    inflation_pct: inflationPct,
    inflation_year: inflationYear,
    gdp_growth_pct: gdp?.value ?? null,
    undernourish_pct: undernourish?.value ?? null,
    note: `World Bank ${inflationYear}: inflation ${inflationPct.toFixed(1)}% → ${level} Economic Stability (national, applied to ${focusCodes.length} focus provinces)${gdpCtx}${underCtx}`,
  };
}

// CLI smoke test: `pnpm tsx ingest/sources/world-bank.ts`
if (process.argv[1] && process.argv[1].endsWith("world-bank.ts")) {
  fetchWorldBank(["PG07", "PG10", "PG11", "PG08"]).then(
    (r) => console.log(JSON.stringify(r, null, 2)),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
