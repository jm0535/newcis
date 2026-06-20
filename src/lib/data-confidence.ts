// src/lib/data-confidence.ts
// Turns the raw ingest-feed health (last_run.sources_ok) into ONE plain-English
// confidence line for non-technical readers — replacing the engineer "feed: FAIL"
// dump that used to sit in the SITREP footer. The raw OK/FAIL list is still
// returned (feeds[]) but is surfaced only in the Technical appendix.
import type { LastRun } from "./types";

export interface DataConfidence {
  level: "GOOD" | "PARTIAL" | "LOW";
  line: string;
  feeds: { name: string; ok: boolean }[];
}

export function dataConfidence(lastRun: LastRun | null): DataConfidence {
  const feeds = Object.entries(lastRun?.sources_ok ?? {}).map(([name, ok]) => ({
    name,
    ok,
  }));

  if (feeds.length === 0) {
    return {
      level: "LOW",
      line:
        "No ingest run has reported this cycle. Figures shown are the last known values; " +
        "figures marked DEMO are seeded references pending a live feed.",
      feeds: [],
    };
  }

  const okCount = feeds.filter((f) => f.ok).length;
  const share = okCount / feeds.length;
  const level: DataConfidence["level"] =
    share >= 0.75 ? "GOOD" : share > 0.2 ? "PARTIAL" : "LOW";

  const line =
    `${okCount} of ${feeds.length} data feeds reported this cycle. ` +
    "Figures marked DEMO are seeded references shown pending a live feed.";

  return { level, line, feeds };
}
