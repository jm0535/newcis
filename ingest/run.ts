/**
 * CLI wrapper around runIngest(). Run via `pnpm ingest` (used by local cron).
 * The same logic is reachable from the dashboard's Refresh button via /api/ingest.
 */
import { promises as fs } from "node:fs";
import { runIngest } from "./lib";

// Light .env.local loader so local CLI runs pick up HDX_APP_ID without an external dep.
// Production (GitHub Actions / Vercel) uses real env vars and never touches this file.
async function loadDotenvLocal() {
  try {
    const content = await fs.readFile(".env.local", "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // no .env.local — fine, env vars only.
  }
}

async function main() {
  await loadDotenvLocal();
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
