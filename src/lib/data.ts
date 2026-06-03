// Server-side read helpers for the JSON data store.
// In Phase 2, swap the fs reads for DB queries — the return types do not change.

import { promises as fs } from "node:fs";
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
  const dir = path.join(DATA_DIR, "sitreps");
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
