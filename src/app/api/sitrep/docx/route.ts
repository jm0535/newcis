// POST /api/sitrep/docx — generate a SITREP from current /data and return it as an
// editable Word document in ONE shot, without depending on a stored file.
//
// Why a one-shot POST (vs GET /api/sitrep/[id]/docx): on Vercel each serverless
// invocation has its own /tmp, so a download that re-reads a just-written report
// by id can land on a different instance and 404. Generating and returning the
// document in the same request is instance-independent — the right path for the
// "download the report I just made" button.
import { NextResponse } from "next/server";
import {
  getIndicators,
  getLastRun,
  getNationalStatus,
  getSectorRisk,
} from "@/lib/data";
import { getWefInsights } from "@/lib/wef";
import { buildSitrepModel } from "@/lib/sitrep";
import { buildSitrepDocx } from "@/lib/sitrep-docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { analyst_note?: string };
    const [national, indicators, sectorRisk, lastRun, wefInsights] = await Promise.all([
      getNationalStatus(),
      getIndicators(),
      getSectorRisk(),
      getLastRun(),
      getWefInsights(),
    ]);

    const model = buildSitrepModel({
      national,
      indicators,
      sectorRisk,
      lastRun,
      wefInsights,
      analystNote: body.analyst_note,
    });
    const buffer = await buildSitrepDocx(model);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename="${model.docTitle}.docx"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
