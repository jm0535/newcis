// POST /api/ingest — invokes the same runIngest() library the CLI uses.
// Powers the Refresh button on Page 4: trigger live updates from the stage.
//
// Long-running (5–60s for HDX paginated pulls). Force the Node runtime and a
// generous maxDuration so Vercel doesn't kill it like a default serverless fn.
import { NextResponse } from "next/server";
import { runIngest } from "../../../../ingest/lib";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const lastRun = await runIngest();
    return NextResponse.json({ ok: true, lastRun });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
