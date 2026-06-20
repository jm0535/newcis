/**
 * NMME dynamical seasonal forecast — projected Niño-3.4 SST → projected ONI.
 *
 * Source: IRI's open CCSR data service (the successor to the IRI Data Library),
 * an OPeNDAP server with NO authentication. This is the genuine model-grade
 * ENSO forecast the operational centres run — NOT a NEWCIS-built projection, so
 * surfacing it is "relay the official agency forecast", not "do AI forecasting"
 * (which CLAUDE.md §0 walls off to production Phase 3). We display NOAA-GFDL's
 * SPEAR member of the North American Multi-Model Ensemble.
 *
 *   https://forecast.ccsr.columbia.edu/data/NMME/NOAA-GFDL/SPEAR/forecast/sst
 *
 * The forecast variable is sst[S][M][L][Y][X]:
 *   S = forecast start (init) month; we take the LATEST (highest index).
 *   M = ensemble member (30); we average across members and keep the spread.
 *   L = lead month (0..11 from init); we use L1..L3 — the forward 3-month window
 *       whose mean is comparable to the 3-month-running ONI.
 *   Y,X = 1° global grid. The Niño-3.4 box is 5°S–5°N, 170°W–120°W, which on
 *       this grid is Y[85..95] (lat -5..+5) and X[190..240] (lon 190..240 °E).
 *
 * Anomaly: the forecast is absolute SST in °C. ONI is an anomaly vs the
 * 1991–2020 base period. Rather than pull the full hindcast climatology cube
 * (360×15×box — a large OPeNDAP transfer every cycle), we anomalise against the
 * published NOAA ERSSTv5 1991–2020 Niño-3.4 monthly climatology baked below.
 * This is standard practice and keeps the cycle pull small (~200 KB, ~3.5 s).
 *
 * Transport: OPeNDAP `.dods` returns the DDS as ASCII, then a `Data:\n` marker,
 * then an 8-byte length prefix, then big-endian IEEE float32 values. We parse
 * that directly — no netCDF library needed for a single constrained request.
 */
import type { Indicator } from "../../src/lib/types";

const SPEAR_FORECAST =
  "https://forecast.ccsr.columbia.edu/data/NMME/NOAA-GFDL/SPEAR/forecast/sst";

// Niño-3.4 box index ranges on the 1° CCSR grid (inclusive, OPeNDAP-style).
const Y0 = 85, Y1 = 95; // lat -5..+5
const X0 = 190, X1 = 240; // lon 170°W..120°W (190..240 °E)
const NY = Y1 - Y0 + 1; // 11
const NX = X1 - X0 + 1; // 51
const N_MEMBERS = 30;
const LEAD_LO = 1, LEAD_HI = 3; // forward 3-month window
const N_LEADS = LEAD_HI - LEAD_LO + 1; // 3
const FILL = -1e34; // _FillValue (land); CCSR uses -1e34, guard with a margin.

// NOAA ERSSTv5 Niño-3.4 monthly climatology, 1991–2020 base period (°C),
// index 0 = January. These are the absolute-SST normals the ONI anomaly is
// measured against; published by NOAA CPC. Used to convert the model's absolute
// forecast SST into a projected ONI-equivalent anomaly.
const NINO34_CLIM_1991_2020: number[] = [
  26.78, 26.83, 27.27, 27.68, 27.80, 27.62,
  27.20, 26.72, 26.62, 26.70, 26.74, 26.70,
];

interface DodsArray {
  values: Float32Array;
}

/**
 * Parse an OPeNDAP `.dods` body: ASCII DDS header, a `Data:\n` separator, an
 * 8-byte length prefix (two big-endian int32 element counts), then big-endian
 * float32 data. Returns the flat value array.
 */
export function parseDods(buf: ArrayBuffer): DodsArray {
  const bytes = new Uint8Array(buf);
  // Find the "Data:\n" marker that separates the ASCII header from binary data.
  const marker = [0x44, 0x61, 0x74, 0x61, 0x3a, 0x0a]; // "Data:\n"
  let dataStart = -1;
  for (let i = 0; i + marker.length <= bytes.length; i++) {
    let hit = true;
    for (let j = 0; j < marker.length; j++) {
      if (bytes[i + j] !== marker[j]) { hit = false; break; }
    }
    if (hit) { dataStart = i + marker.length; break; }
  }
  if (dataStart < 0) throw new Error("CCSR dods: no Data: marker");
  // After the marker: an 8-byte length prefix (two BE int32, both = element
  // count for a Float32 array), then the float32 values.
  const view = new DataView(buf);
  const count = view.getInt32(dataStart, false); // big-endian
  const floatStart = dataStart + 8;
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = view.getFloat32(floatStart + i * 4, false);
  }
  return { values: out };
}

/** Area-mean of a Niño-3.4 (member,lead) slice, skipping fill/land cells. */
function boxMean(values: Float32Array, offset: number): number {
  let sum = 0, n = 0;
  for (let k = 0; k < NY * NX; k++) {
    const v = values[offset + k];
    if (Number.isFinite(v) && v > FILL + 1e30) { sum += v; n++; }
  }
  return n > 0 ? sum / n : NaN;
}

export interface CcsrNmmeResult {
  indicator: Indicator;
  /** Per-member projected ONI (3-mo mean anomaly), for the ensemble plume. */
  members: number[];
  ensemble_mean: number;
  ensemble_min: number;
  ensemble_max: number;
  init_month: string; // ISO YYYY-MM-01 of the forecast init
  target_window: string; // human label, e.g. "MJJ 2026"
}

/**
 * Decode the CCSR `target` coordinate to an ISO YYYY-MM-01 string. The variable's
 * CF units are "days since 1960-01-01" (confirmed via the server's .das) — NOT
 * hours. Using hours here mis-scaled every date by 24× (a 2026 target decoded as
 * ~1962), so the conversion is days → milliseconds.
 */
function targetToIso(daysSince1960: number): string {
  const base = Date.UTC(1960, 0, 1);
  const d = new Date(base + daysSince1960 * 86_400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

// Indexed by (centre month − 1): the NOAA 3-month season centred on that month.
// Jan→DJF, …, Jun→MJJ, …, Dec→NDJ.
const SEASON3 = ["DJF", "JFM", "FMA", "MAM", "AMJ", "MJJ", "JJA", "JAS", "ASO", "SON", "OND", "NDJ"];

export async function fetchCcsrNmme(): Promise<CcsrNmmeResult> {
  // 1. Latest init index = last S. Read S count from the DDS.
  const ddsRes = await fetch(`${SPEAR_FORECAST}.dds`, { signal: AbortSignal.timeout(20_000) });
  if (!ddsRes.ok) throw new Error(`CCSR dds: HTTP ${ddsRes.status}`);
  const dds = await ddsRes.text();
  const sMatch = dds.match(/sst\[S = (\d+)\]/);
  if (!sMatch) throw new Error("CCSR dds: cannot read S dimension");
  const sLast = Number(sMatch[1]) - 1;

  // 2. Forecast init + target months for this start, leads 0..3 (target array).
  const tgtRes = await fetch(
    `${SPEAR_FORECAST}.dods?target[${sLast}:${sLast}][0:${LEAD_HI}]`,
    { signal: AbortSignal.timeout(20_000) },
  );
  if (!tgtRes.ok) throw new Error(`CCSR target: HTTP ${tgtRes.status}`);
  const tgt = parseDodsInt32(await tgtRes.arrayBuffer());
  const initIso = targetToIso(tgt[0]); // L0 target = init month
  const midIso = targetToIso(tgt[2]); // L2 = centre of the L1..L3 window
  const midMonth = Number(midIso.slice(5, 7)); // 1..12
  const targetWindow = `${SEASON3[midMonth - 1]} ${midIso.slice(0, 4)}`;

  // 3. Pull the Niño-3.4 box for all members, leads 1..3, latest start.
  const url =
    `${SPEAR_FORECAST}.dods?sst[${sLast}:${sLast}][0:${N_MEMBERS - 1}]` +
    `[${LEAD_LO}:${LEAD_HI}][${Y0}:${Y1}][${X0}:${X1}]`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`CCSR forecast: HTTP ${res.status}`);
  const { values } = parseDods(await res.arrayBuffer());

  // Layout is [S=1][M=30][L=3][Y=11][X=51], row-major. For each member, average
  // its three lead months' box-means → the member's 3-month projected SST, then
  // anomalise against the climatology of each lead's target month.
  const sliceLen = NY * NX;
  const members: number[] = [];
  for (let m = 0; m < N_MEMBERS; m++) {
    let anomSum = 0, leadsUsed = 0;
    for (let l = 0; l < N_LEADS; l++) {
      const offset = (m * N_LEADS + l) * sliceLen;
      const sst = boxMean(values, offset);
      if (!Number.isFinite(sst)) continue;
      // Climatology month for this lead = init month + (LEAD_LO + l).
      const initMonth0 = Number(initIso.slice(5, 7)) - 1; // 0-based init month
      const targetMonth0 = (initMonth0 + LEAD_LO + l) % 12;
      anomSum += sst - NINO34_CLIM_1991_2020[targetMonth0];
      leadsUsed++;
    }
    if (leadsUsed > 0) members.push(anomSum / leadsUsed);
  }
  if (members.length === 0) throw new Error("CCSR: no valid ensemble members");

  const mean = members.reduce((a, b) => a + b, 0) / members.length;
  const min = Math.min(...members);
  const max = Math.max(...members);

  const indicator: Indicator = {
    key: "PROJECTED_ONI",
    label: `Projected ONI (${targetWindow}, ${members.length}-member NMME mean)`,
    unit: "°C SST anomaly (Niño 3.4, dynamical forecast)",
    source: "NMME · NOAA-GFDL SPEAR (IRI CCSR)",
    update_frequency: "monthly",
    provenance: "LIVE",
    value: Math.round(mean * 100) / 100,
    observed_at: initIso, // forecast init date — honest "as of" for a forecast
    trend: "flat", // set by orchestrator against readings_history
  };

  return {
    indicator,
    members: members.map((v) => Math.round(v * 100) / 100),
    ensemble_mean: Math.round(mean * 100) / 100,
    ensemble_min: Math.round(min * 100) / 100,
    ensemble_max: Math.round(max * 100) / 100,
    init_month: initIso,
    target_window: targetWindow,
  };
}

/** Parse a `.dods` body whose data section is big-endian int32 (the target var). */
function parseDodsInt32(buf: ArrayBuffer): number[] {
  const bytes = new Uint8Array(buf);
  const marker = [0x44, 0x61, 0x74, 0x61, 0x3a, 0x0a];
  let dataStart = -1;
  for (let i = 0; i + marker.length <= bytes.length; i++) {
    let hit = true;
    for (let j = 0; j < marker.length; j++) if (bytes[i + j] !== marker[j]) { hit = false; break; }
    if (hit) { dataStart = i + marker.length; break; }
  }
  if (dataStart < 0) throw new Error("CCSR dods(int32): no Data: marker");
  const view = new DataView(buf);
  const count = view.getInt32(dataStart, false);
  const start = dataStart + 8;
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(view.getInt32(start + i * 4, false));
  return out;
}

// CLI smoke test: `pnpm tsx ingest/sources/ccsr-nmme.ts`
if (process.argv[1] && process.argv[1].endsWith("ccsr-nmme.ts")) {
  fetchCcsrNmme().then(
    (r) => console.log(JSON.stringify(r, null, 2)),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
