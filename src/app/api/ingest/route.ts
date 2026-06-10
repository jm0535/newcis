// POST /api/ingest — invokes the same runIngest() library the CLI uses.
// Powers the Refresh button on Page 4: trigger live updates from the stage.
//
// Long-running (5–60s for HDX paginated pulls). Force the Node runtime and a
// generous maxDuration so Vercel doesn't kill it like a default serverless fn.
//
// Access gate (opt-in): this endpoint mutates state (a cycle rewrites /data),
// so it is gateable by a shared secret. If INGEST_SECRET is set, every POST must
// carry a matching `x-ingest-secret` header or it is rejected 401. If the env var
// is UNSET, the endpoint stays open — that is the public-demo posture, where the
// on-page Refresh button must work for anonymous visitors. A hardened (non-demo)
// deployment sets INGEST_SECRET and drives ingest from the GitHub Action / CLI
// (which can supply the header) instead of the browser button. The secret is
// never shipped to the client, so the demo button cannot send it — that is the
// point: turning the gate on intentionally disables anonymous browser triggers.
import { NextResponse } from "next/server";
import { runIngest } from "../../../../ingest/lib";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.INGEST_SECRET;
  if (secret && req.headers.get("x-ingest-secret") !== secret) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }
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
