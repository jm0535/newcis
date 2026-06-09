// Server-side read helpers for the JSON data store.
// In Phase 2, swap the fs reads for DB queries — the return types do not change.

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  Indicator,
  HistoricalReading,
  RiskThreshold,
  SectorRisk,
  NationalStatus,
  LastRun,
  Sitrep,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

// Where generated SITREPs are written/read. On Vercel the deployment dir
// (/var/task) is READ-ONLY — only the OS temp dir is writable in a serverless
// function — so in production we write to a temp folder. Locally we keep them in
// the repo's data/sitreps so they persist across runs. Reports are ephemeral in
// production (they live for the lambda's warm lifetime), which is fine for the
// PoC demo flow: generate, then immediately open or download. Durable storage
// returns with the database in Phase 2 (see CLAUDE.md §1).
//
// All four touchpoints — POST (write), GET html, GET docx, and listSitreps —
// MUST resolve the same directory, so this helper is the single source of truth.
export function sitrepsDir(): string {
  const onVercel = !!process.env.VERCEL;
  return onVercel
    ? path.join(os.tmpdir(), "newcis-sitreps")
    : path.join(DATA_DIR, "sitreps");
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const buf = await fs.readFile(path.join(DATA_DIR, file), "utf8");
    return JSON.parse(buf) as T;
  } catch {
    return fallback;
  }
}

export const getIndicators = () => readJson<Indicator[]>("indicators.json", []);
export const getReadingsHistory = () =>
  readJson<HistoricalReading[]>("readings_history.json", []);
export const getRiskThresholds = () =>
  readJson<RiskThreshold[]>("risk_thresholds.json", []);
export const getSectorRisk = () => readJson<SectorRisk[]>("sector_risk.json", []);
export const getNationalStatus = () =>
  readJson<NationalStatus | null>("national_status.json", null);
export const getLastRun = () => readJson<LastRun | null>("last_run.json", null);

export async function listSitreps(): Promise<Sitrep[]> {
  const dir = sitrepsDir();
  try {
    const files = await fs.readdir(dir);
    const reports = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => JSON.parse(await fs.readFile(path.join(dir, f), "utf8")) as Sitrep),
    );
    return reports.sort((a, b) => b.generated_at.localeCompare(a.generated_at));
  } catch {
    return [];
  }
}
