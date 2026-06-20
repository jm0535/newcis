// src/lib/sitrep-raster.ts
// SVG → PNG for the .docx report. Word embeds PNG reliably across versions
// (including older government installs where native SVG-in-Word fails), so each
// SITREP visual is rasterized here before going into the document. Node-only
// (wraps @resvg/resvg-js native bindings) — isolated from the pure SVG builders
// so those stay testable without the native module.
import { Resvg } from "@resvg/resvg-js";

// Rasterize at a target pixel width; height follows the SVG's aspect ratio.
// `width` should be ~2× the on-page render width for crisp print output.
export async function svgToPng(svg: string, width: number): Promise<Buffer> {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    background: "#ffffff",
  });
  return Buffer.from(resvg.render().asPng());
}
