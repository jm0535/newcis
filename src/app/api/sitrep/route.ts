// POST /api/sitrep — generate a Weekly SITREP from current /data, persist it to
// /data/sitreps/<id>.json, and return the artefact so the dashboard can open it
// for print-to-PDF on the spot.
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  getIndicators,
  getLastRun,
  getNationalStatus,
  getSectorRisk,
  sitrepsDir,
} from "@/lib/data";
import { getWefInsights } from "@/lib/wef";
import { generateSitrep } from "@/lib/sitrep";

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

    const sitrep = generateSitrep({
      national,
      indicators,
      sectorRisk,
      lastRun,
      wefInsights,
      analystNote: body.analyst_note,
    });

    const dir = sitrepsDir();
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${sitrep.id}.json`), JSON.stringify(sitrep, null, 2));

    return NextResponse.json({ ok: true, sitrep });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
