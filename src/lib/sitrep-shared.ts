// Shared SITREP constants. The HTML view (sitrep.ts) and the editable .docx
// export (sitrep-docx.ts) render the SAME report two ways — anything they BOTH
// state must live here so the two artefacts can never drift apart.

// The provincial-risk table caption. Both renderers print this verbatim; pinning
// it here means an edit to the wording lands in the HTML and the Word doc at once.
// (The traffic-light fill palette is deliberately NOT shared: the HTML pills are
// keyed by the GREEN/AMBER/RED/BLACK alert vocabulary baked into the print CSS,
// while the docx fills key off the LOW/MED/HIGH/CRITICAL level — two different
// vocabularies, so a single map would force a rewrite of one renderer's contract.)
export function provincialRiskCaption(provinceCount: number, provincesAtRisk: number): string {
  return (
    `All ${provinceCount} provinces ranked worst-first by their single most-stressed ` +
    `sector. ${provincesAtRisk} of ${provinceCount} sit at HIGH or CRITICAL. ` +
    `"Stressed" counts how many of a province's sectors are at HIGH or CRITICAL.`
  );
}
