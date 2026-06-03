/**
 * CLI wrapper around runIngest(). Run via `pnpm ingest` (used by local cron).
 * The same logic is reachable from the dashboard's Refresh button via /api/ingest.
 */
import { runIngest } from "./lib";

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`[ingest] start ${startedAt}`);
  if (!process.env.HDX_APP_ID) {
    console.warn("[ingest] HDX_APP_ID not set — HDX sources will be marked failed");
  }
  const lastRun = await runIngest();
  console.log(`[ingest] done status=${lastRun.status}`);
  console.log(`[ingest] ${lastRun.notes}`);
}

main().catch((e) => {
  console.error("[ingest] FATAL", e);
  process.exit(1);
});
