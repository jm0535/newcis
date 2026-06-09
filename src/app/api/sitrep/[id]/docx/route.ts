// GET /api/sitrep/[id]/docx — serve a stored SITREP as an editable Word document
// so executives can open it in Word, edit, and re-share. Built from the report's
// persisted point-in-time model (Sitrep.model); for reports stored before the
// model was persisted, falls back to rebuilding from current /data.
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import type { Sitrep } from "@/lib/types";
import { buildSitrepModel } from "@/lib/sitrep";
import { buildSitrepDocx } from "@/lib/sitrep-docx";
import {
  getIndicators,
  getLastRun,
  getNationalStatus,
  getSectorRisk,
  sitrepsDir,
} from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Defence-in-depth: id arrives in a path segment, but never trust it for fs.
  if (!/^sitrep-[A-Za-z0-9_-]+$/.test(id)) {
    return NextResponse.json({ ok: false, error: "invalid id" }, { status: 400 });
  }

  let sitrep: Sitrep;
  try {
    const file = path.join(sitrepsDir(), `${id}.json`);
    sitrep = JSON.parse(await fs.readFile(file, "utf8")) as Sitrep;
  } catch {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  try {
    // Prefer the persisted point-in-time model. Older reports predate it — rebuild
    // from current data (a best-effort approximation, flagged by its own footer).
    let model = sitrep.model;
    if (!model) {
      const [national, indicators, sectorRisk, lastRun] = await Promise.all([
        getNationalStatus(),
        getIndicators(),
        getSectorRisk(),
        getLastRun(),
      ]);
      model = buildSitrepModel({
        national,
        indicators,
        sectorRisk,
        lastRun,
        analystNote: sitrep.analyst_note,
      });
    }

    const buffer = await buildSitrepDocx(model);
    const filename = `${model.docTitle}.docx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
