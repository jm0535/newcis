// GET /api/sitrep/[id] — serve a stored SITREP's HTML body so the user can
// open it in a new tab and print-to-PDF.
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import type { Sitrep } from "@/lib/types";
import { sitrepsDir } from "@/lib/data";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Defence-in-depth: id arrives in a path segment, but never trust it for fs.
  if (!/^sitrep-[A-Za-z0-9_-]+$/.test(id)) {
    return NextResponse.json({ ok: false, error: "invalid id" }, { status: 400 });
  }
  try {
    const file = path.join(sitrepsDir(), `${id}.json`);
    const raw = await fs.readFile(file, "utf8");
    const sitrep = JSON.parse(raw) as Sitrep;
    return new NextResponse(sitrep.html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
}
