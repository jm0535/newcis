/**
 * OCHA FTS (Financial Tracking Service) — humanitarian-funding ops signal.
 *
 * FTS is OCHA's keyless public record of every reported humanitarian funding
 * flow, by recipient country and year. We pull PNG's INCOMING funding for the
 * current year:
 *   - incoming.fundingTotal (USD) + incoming.flowCount — the OPERATIONAL RESPONSE
 *     SIGNAL. When donors are moving money into PNG, the international system has
 *     judged a humanitarian need worth funding: rising committed funding is a
 *     real-world confirmation that a crisis is being responded to on the ground.
 *     It is the demand-side mirror of our hazard feeds (EONET, GVP, GDACS) and
 *     impact feeds (food security, health) — those say "the hazard is here", FTS
 *     says "the response is being paid for". More money flowing = more response
 *     activity = a more active Disaster & Hazard picture.
 *
 * FTS reports at the national (recipient-country) level — there is no PNG admin-1
 * funding breakdown. So, exactly like the World Bank / WHO GHO national-signal
 * pattern, we apply the one national funding figure uniformly to the focus
 * provinces and SAY SO in the caption. Honest national-derived ops signal, not a
 * faked per-province measurement.
 *
 * This is an OPERATIONAL CONTEXT signal layered onto Disaster & Hazard, NOT an
 * ENSO climate driver — it emits sector_rows only, no gauge indicator, so it
 * never enters the climate-indicator panel or the national ENSO alert rollup.
 *
 * Endpoint (FTS v1 public):
 *   https://api.hpc.tools/v1/public/fts/flow?countryISO3=PNG&year={YEAR}
 *   → data.incoming.fundingTotal (USD), data.incoming.flowCount
 */
import type { SectorRisk } from "../../src/lib/types";

const FTS_BASE = "https://api.hpc.tools/v1/public/fts/flow";

interface FtsFlowBody {
  status: string;
  data?: {
    incoming?: {
      fundingTotal?: number | null;
      flowCount?: number | null;
    };
  };
}

/**
 * Incoming humanitarian funding (USD, year-to-date) → Disaster & Hazard level.
 * PNG runs low-millions of humanitarian funding in a calm year; a major ENSO
 * drought or disaster spikes committed funding into the tens of millions. Bands
 * are calibrated so a quiet year reads "low" (background) and a funded crisis
 * climbs — funding is a LAGGING confirmation, so it escalates conservatively:
 *   <$5M low (background) · $5–20M med (active response) · $20–50M high (major
 *   appeal) · >$50M critical (large-scale emergency funding).
 */
function classifyFunding(usd: number): SectorRisk["level"] {
  if (usd >= 50_000_000) return "critical";
  if (usd >= 20_000_000) return "high";
  if (usd >= 5_000_000) return "med";
  return "low";
}

async function fetchFlow(year: number): Promise<{ total: number; count: number }> {
  const url = `${FTS_BASE}?countryISO3=PNG&year=${year}`;
  const res = await fetch(url, {
    headers: { "user-agent": "newcis-ingest/0.1", accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`OCHA FTS: HTTP ${res.status}`);
  const body = (await res.json()) as FtsFlowBody;
  const inc = body.data?.incoming;
  return {
    total: inc?.fundingTotal ?? 0,
    count: inc?.flowCount ?? 0,
  };
}

export interface OchaFtsResult {
  sector_rows: SectorRisk[];
  funding_usd: number;
  flow_count: number;
  year: number;
  note: string;
}

export async function fetchOchaFts(focusCodes: string[]): Promise<OchaFtsResult> {
  const year = new Date().getUTCFullYear();
  let flow = await fetchFlow(year);
  // Early in a calendar year PNG may have no flows reported yet; fall back to the
  // prior year so the signal reflects the most recent funded response, not a
  // misleading zero. The caption names whichever year is shown.
  let shownYear = year;
  if (flow.total === 0 && flow.count === 0) {
    const prev = await fetchFlow(year - 1);
    if (prev.total > 0 || prev.count > 0) {
      flow = prev;
      shownYear = year - 1;
    }
  }

  const level = classifyFunding(flow.total);
  // Score within 0..1, anchored so the critical band (≥$50M) saturates near 1.
  const score = Math.min(1, flow.total / 50_000_000);
  const observedAt = new Date().toISOString();

  const millions = (flow.total / 1_000_000).toFixed(1);
  const caption = `OCHA FTS · $${millions}M incoming, ${flow.count} flow${flow.count === 1 ? "" : "s"} (${shownYear}, national)`;

  const sector_rows: SectorRisk[] = focusCodes.map((code) => ({
    province_code: code,
    sector: "Disaster & Hazard",
    level,
    score,
    trend: "flat",
    provenance: "LIVE",
    as_of: observedAt,
    data_source: caption,
  }));

  return {
    sector_rows,
    funding_usd: flow.total,
    flow_count: flow.count,
    year: shownYear,
    note: `OCHA FTS ${shownYear}: $${millions}M incoming humanitarian funding across ${flow.count} flow(s) → ${level} Disaster & Hazard ops signal (national, applied to ${focusCodes.length} focus provinces)`,
  };
}

// CLI smoke test: `pnpm tsx ingest/sources/ocha-fts.ts`
if (process.argv[1] && process.argv[1].endsWith("ocha-fts.ts")) {
  fetchOchaFts(["PG07", "PG10", "PG11", "PG08"]).then(
    (r) => console.log(JSON.stringify(r, null, 2)),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
