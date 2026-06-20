/**
 * WHO Global Health Observatory (GHO) — Public Health sector signal.
 *
 * GHO's OData API is fully keyless and returns country time series for WHO's
 * health indicators. We pull two PNG series:
 *   - MALARIA_EST_INCIDENCE  (estimated malaria cases per 1,000 at risk) — the
 *     Public Health RISK DRIVER. Malaria is climate-sensitive: El Niño droughts
 *     and the floods that follow both shift mosquito breeding, and PNG already
 *     carries one of the Western Pacific's heaviest malaria burdens. Rising
 *     incidence is the health signal that tracks with the ENSO picture.
 *   - NUTSTUNTINGPREV (under-5 stunting prevalence, both sexes) — CONTEXT only,
 *     carried in the caption. Chronic child undernutrition is the standing
 *     vulnerability a drought shock lands on; it frames the malaria number but
 *     doesn't itself move the alert band.
 *
 * GHO reports at the national level only — there is no PNG admin-1 health
 * breakdown in this feed. So, exactly like the ACLED national-signal pattern,
 * we apply the one national malaria figure uniformly to the focus provinces and
 * SAY SO in the caption. It's an honest national-derived baseline, not a faked
 * per-province measurement.
 *
 * Endpoint (OData v4):
 *   https://ghoapi.azureedge.net/api/{INDICATOR}?$filter=SpatialDim eq 'PNG'
 */
import type { Indicator, SectorRisk } from "../../src/lib/types";

const GHO_BASE = "https://ghoapi.azureedge.net/api";
const MALARIA_CODE = "MALARIA_EST_INCIDENCE";
const STUNTING_CODE = "NUTSTUNTINGPREV";

interface GhoRow {
  SpatialDim: string;
  TimeDim: number;
  Dim1: string | null;
  NumericValue: number | null;
}

/**
 * Malaria incidence (cases per 1,000 at risk) → Public Health level. PNG's
 * modelled incidence runs ~140–180/1,000 in recent years (one of the region's
 * highest) — so that range is PNG's ENDEMIC NORMAL, not a crisis. Bands are
 * calibrated against that baseline (mirroring the MALARIA_INCIDENCE row in
 * risk_thresholds.json) so the chronic heavy burden reads "med" (watch), not a
 * permanent "high"/"critical" that would falsely pin every province in crisis:
 *   <120 low for PNG · 120–200 standing endemic load (watch) · 200–300 genuine
 *   surge · >300 epidemic-scale.
 */
function classifyMalaria(incidencePer1000: number): SectorRisk["level"] {
  if (incidencePer1000 >= 300) return "critical";
  if (incidencePer1000 >= 200) return "high";
  if (incidencePer1000 >= 120) return "med";
  return "low";
}

async function fetchSeries(code: string): Promise<GhoRow[]> {
  const url = `${GHO_BASE}/${code}?$filter=${encodeURIComponent(`SpatialDim eq 'PNG'`)}`;
  const res = await fetch(url, {
    headers: { "user-agent": "newcis-ingest/0.1", accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`WHO GHO ${code}: HTTP ${res.status}`);
  const body = (await res.json()) as { value: GhoRow[] };
  return body.value ?? [];
}

/** Latest numeric row, optionally filtered to a Dim1 (sex) breakdown. */
function latestNumeric(rows: GhoRow[], dim1?: string): GhoRow | null {
  const usable = rows
    .filter((r) => r.NumericValue !== null && (dim1 === undefined || r.Dim1 === dim1))
    .sort((a, b) => a.TimeDim - b.TimeDim);
  return usable.length > 0 ? usable[usable.length - 1] : null;
}

export interface WhoGhoResult {
  indicator: Indicator;
  sector_rows: SectorRisk[];
  malaria_incidence: number;
  malaria_year: number;
  stunting_pct: number | null;
  stunting_year: number | null;
  note: string;
}

export async function fetchWhoGho(focusCodes: string[]): Promise<WhoGhoResult> {
  const [malariaRows, stuntingRows] = await Promise.all([
    fetchSeries(MALARIA_CODE),
    fetchSeries(STUNTING_CODE),
  ]);

  const malaria = latestNumeric(malariaRows);
  if (!malaria || malaria.NumericValue === null) {
    throw new Error("WHO GHO: no numeric malaria-incidence row for PNG");
  }
  const incidence = malaria.NumericValue;
  const malariaYear = malaria.TimeDim;

  // Stunting: both-sexes (SEX_BTSX) preferred; context for the caption only.
  const stunting = latestNumeric(stuntingRows, "SEX_BTSX") ?? latestNumeric(stuntingRows);
  const stuntingPct = stunting?.NumericValue ?? null;
  const stuntingYear = stunting?.TimeDim ?? null;

  const observedAt = new Date(Date.UTC(malariaYear, 11, 31)).toISOString();
  const level = classifyMalaria(incidence);
  // Score within the 0..1 sector scale, anchored so the epidemic band (≥300/1000)
  // saturates near 1 and PNG's endemic baseline reads mid-scale.
  const score = Math.min(1, incidence / 300);

  const indicator: Indicator = {
    key: "MALARIA_INCIDENCE",
    label: "Malaria incidence (estimated)",
    unit: "cases per 1,000 at risk",
    source: "WHO Global Health Observatory (GHO)",
    update_frequency: "annual",
    provenance: "LIVE",
    value: incidence,
    observed_at: observedAt,
    trend: "flat", // computed by the orchestrator against readings_history
  };

  const stuntingCtx =
    stuntingPct !== null
      ? `; under-5 stunting ${stuntingPct.toFixed(1)}% (${stuntingYear})`
      : "";
  const caption = `WHO GHO · malaria ${incidence.toFixed(0)}/1,000 (${malariaYear}, national)${stuntingCtx}`;

  const sector_rows: SectorRisk[] = focusCodes.map((code) => ({
    province_code: code,
    sector: "Public Health",
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
    malaria_incidence: incidence,
    malaria_year: malariaYear,
    stunting_pct: stuntingPct,
    stunting_year: stuntingYear,
    note: `WHO GHO ${malariaYear}: malaria ${incidence.toFixed(1)}/1,000 → ${level} Public Health (national, applied to ${focusCodes.length} focus provinces)${stuntingCtx}`,
  };
}

// CLI smoke test: `pnpm tsx ingest/sources/who-gho.ts`
if (process.argv[1] && process.argv[1].endsWith("who-gho.ts")) {
  fetchWhoGho(["PG07", "PG10", "PG11", "PG08"]).then(
    (r) => console.log(JSON.stringify(r, null, 2)),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
