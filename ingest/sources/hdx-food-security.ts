/**
 * HDX HAPI — IPC food-security phase per PNG admin1.
 *
 *   GET /api/v2/food-security-nutrition-poverty/food-security
 *     ?location_code=PNG
 *     &ipc_type=current
 *     &output_format=json
 *     &app_identifier=...
 *
 * Returns rows with admin1_code, ipc_phase, population_in_phase. PNG is not always
 * published in IPC — when the response is empty for PNG, we return an empty array and the
 * orchestrator marks the sector DEMO with a "no current IPC data for PNG" note.
 *
 * Aggregation: for each focus admin1 we take the highest IPC phase reported (worst-case)
 * and the summed population_in_phase across phases ≥3 (crisis or worse).
 */
import type { SectorRisk, RiskLevel } from "../../src/lib/types";

const BASE = "https://hapi.humdata.org/api/v2/food-security-nutrition-poverty/food-security";

interface HapiRow {
  location_code: string;
  admin1_code: string;
  admin1_name: string;
  admin_level: number;
  ipc_phase: string; // "1" .. "5"
  ipc_type: string;
  population_in_phase: number;
  reference_period_start: string;
  reference_period_end: string;
}

function ipcToRiskLevel(maxPhase: number): RiskLevel {
  if (maxPhase >= 4) return "critical";
  if (maxPhase >= 3) return "high";
  if (maxPhase >= 2) return "med";
  return "low";
}

export async function fetchHdxFoodSecurity(
  appId: string,
  provinceCodes: string[],
): Promise<{ rows: SectorRisk[]; raw_count: number; note: string }> {
  const url = `${BASE}?location_code=PNG&ipc_type=current&output_format=json&limit=10000&app_identifier=${appId}`;
  const res = await fetch(url, { headers: { "user-agent": "newcis-ingest/0.1" } });
  if (!res.ok) throw new Error(`HDX food-security: HTTP ${res.status}`);
  const body = (await res.json()) as { data: HapiRow[] };

  if (!body.data.length) {
    return {
      rows: [],
      raw_count: 0,
      note: "HDX HAPI returned no current IPC food-security rows for PNG (PNG is not consistently in IPC publications). Sector will be DEMO-seeded.",
    };
  }

  // Group by admin1_code → highest phase reported, sum population in phases ≥3.
  const byProv = new Map<string, { maxPhase: number; popAtRisk: number; latest: string }>();
  for (const r of body.data) {
    const phase = Number(r.ipc_phase);
    if (!Number.isFinite(phase)) continue;
    const prev = byProv.get(r.admin1_code) ?? { maxPhase: 0, popAtRisk: 0, latest: "" };
    prev.maxPhase = Math.max(prev.maxPhase, phase);
    if (phase >= 3) prev.popAtRisk += r.population_in_phase ?? 0;
    if (r.reference_period_end > prev.latest) prev.latest = r.reference_period_end;
    byProv.set(r.admin1_code, prev);
  }

  const asOf = new Date().toISOString();
  const rows: SectorRisk[] = [];
  for (const code of provinceCodes) {
    const agg = byProv.get(code);
    if (!agg) continue;
    rows.push({
      province_code: code,
      sector: "Food Security",
      level: ipcToRiskLevel(agg.maxPhase),
      score: Math.min(1, agg.maxPhase / 5),
      trend: "flat", // requires a previous snapshot to compute; engine fills later
      provenance: "LIVE",
      as_of: asOf,
      data_source: "HDX HAPI · IPC current",
    });
  }

  return {
    rows,
    raw_count: body.data.length,
    note: `HDX HAPI returned ${body.data.length} IPC rows; matched ${rows.length} focus provinces.`,
  };
}

// CLI smoke test: `HDX_APP_ID=... pnpm tsx ingest/sources/hdx-food-security.ts`
if (process.argv[1] && process.argv[1].endsWith("hdx-food-security.ts")) {
  const appId = process.env.HDX_APP_ID;
  if (!appId) throw new Error("HDX_APP_ID env var required");
  // focus province p-codes from CLAUDE.md §2 — Enga, Western Highlands, Southern Highlands, Gulf
  const focus = ["PG08", "PG09", "PG07", "PG02"];
  fetchHdxFoodSecurity(appId, focus).then(
    (r) => console.log(JSON.stringify(r, null, 2)),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
