/**
 * HDX HAPI — ACLED conflict events per focus province admin1.
 *
 * ACLED indexes political violence + protest events; HDX HAPI exposes a
 * pre-aggregated table by (admin1, event_type, reference_period). We pull
 * the last 90 days for PNG, group by admin1_code, and turn event counts
 * into Social Stability risk cells.
 *
 * Why event counts not fatalities: counts are the more robust signal at
 * province-month resolution. Fatalities are heavy-tailed (one massacre swamps
 * the trend); counts track operational tempo better.
 */
import type { SectorRisk } from "../../src/lib/types";

const ENDPOINT = "https://hapi.humdata.org/api/v2/coordination-context/conflict-events";

interface AcledRow {
  location_code: string;
  admin1_code: string | null;
  admin1_name: string | null;
  event_type: string;
  events: number;
  fatalities: number;
  reference_period_start: string;
  reference_period_end: string;
}

function classifyEventCount(events: number): SectorRisk["level"] {
  // PNG admin1 baseline: most provinces see <5 events/quarter in non-crisis years.
  // Bands tuned for that scale; revisit if backfilled ACLED data shifts the priors.
  if (events >= 30) return "critical";
  if (events >= 15) return "high";
  if (events >= 5) return "med";
  return "low";
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export interface AcledResult {
  sector_rows: SectorRisk[];
  raw_count: number;
  window_days: number;
  note: string;
}

export async function fetchHdxAcled(appId: string, focusCodes: string[]): Promise<AcledResult> {
  const end = new Date();
  const start = new Date(end.getTime() - 90 * 24 * 3600 * 1000);
  const params = new URLSearchParams({
    location_code: "PNG",
    output_format: "json",
    start_date: isoDate(start),
    end_date: isoDate(end),
    limit: "10000",
    app_identifier: appId,
  });
  const res = await fetch(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HDX ACLED: HTTP ${res.status}`);
  const body = (await res.json()) as { data: AcledRow[] };
  const rows = body.data ?? [];

  // Sum events per admin1_code, focus-province only.
  const totals = new Map<string, { events: number; fatalities: number; name: string }>();
  for (const r of rows) {
    if (!r.admin1_code || !focusCodes.includes(r.admin1_code)) continue;
    const prev = totals.get(r.admin1_code) ?? { events: 0, fatalities: 0, name: r.admin1_name ?? "" };
    prev.events += r.events ?? 0;
    prev.fatalities += r.fatalities ?? 0;
    if (!prev.name && r.admin1_name) prev.name = r.admin1_name;
    totals.set(r.admin1_code, prev);
  }

  const sector_rows: SectorRisk[] = [];
  for (const code of focusCodes) {
    const t = totals.get(code) ?? { events: 0, fatalities: 0, name: "" };
    sector_rows.push({
      province_code: code,
      sector: "Social Stability",
      level: classifyEventCount(t.events),
      score: Math.min(1, t.events / 30),
      trend: "flat",
      provenance: "LIVE",
      as_of: new Date().toISOString(),
      data_source: `ACLED · ${t.events} events / ${t.fatalities} fatalities (90d)`,
    });
  }

  return {
    sector_rows,
    raw_count: rows.length,
    window_days: 90,
    note:
      rows.length === 0
        ? "ACLED returned no rows for PNG in the 90-day window — quiet period or HDX caching."
        : `${rows.length} ACLED rows aggregated to ${sector_rows.length} focus-province cells`,
  };
}
