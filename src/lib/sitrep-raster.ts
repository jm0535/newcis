// src/lib/sitrep-raster.ts
// SVG → PNG for the .docx report. Word embeds PNG reliably across versions
// (including older government installs where native SVG-in-Word fails), so each
// SITREP visual is rasterized here before going into the document. Node-only
// (wraps @resvg/resvg-js native bindings) — isolated from the pure SVG builders
// so those stay testable without the native module.
//
// resvg does NOT use the host's installed fonts unless told to, and serverless
// hosts (Vercel) ship with no fonts at all — so any <text> in the SVG silently
// renders blank. We therefore bundle a single Latin font (Liberation Sans, which
// covers the report's accents, ×, …, the em-dash and the ▲▼ trend glyphs) and
// point resvg at it explicitly. This makes rasterization deterministic on every
// machine, local or cloud.
import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FONT_DIR = join(process.cwd(), "assets", "fonts");
const FONT_FILES = [
  join(FONT_DIR, "LiberationSans-Regular.ttf"),
  join(FONT_DIR, "LiberationSans-Bold.ttf"),
];
export const RASTER_FONT_FAMILY = "Liberation Sans";

// Read the font bytes once so a missing/unreadable bundle fails loudly at module
// load (and during tests) rather than producing silent text-less PNGs in prod.
for (const f of FONT_FILES) readFileSync(f);

// Rasterize at a target pixel width; height follows the SVG's aspect ratio.
// `width` should be ~2× the on-page render width for crisp print output.
export async function svgToPng(svg: string, width: number): Promise<Buffer> {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    background: "#ffffff",
    font: {
      loadSystemFonts: false,
      fontFiles: FONT_FILES,
      defaultFontFamily: RASTER_FONT_FAMILY,
      sansSerifFamily: RASTER_FONT_FAMILY,
    },
  });
  return Buffer.from(resvg.render().asPng());
}
