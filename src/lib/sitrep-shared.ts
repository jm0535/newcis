// Shared SITREP constants. The HTML view (sitrep.ts) and the editable .docx
// export (sitrep-docx.ts) render the SAME report two ways — anything they BOTH
// state must live here so the two artefacts can never drift apart.
import type { SectorRisk, SitrepModel } from "./types";
import type { WefInsight } from "./wef";
import { FOCUS_NAMES } from "./focus-provinces";

// The provincial-risk table caption. Both renderers print this verbatim; pinning
// it here means an edit to the wording lands in the HTML and the Word doc at once.
// (The traffic-light fill palette is deliberately NOT shared: the HTML pills are
// keyed by the GREEN/AMBER/RED/BLACK alert vocabulary baked into the print CSS,
// while the docx fills key off the LOW/MED/HIGH/CRITICAL level — two different
// vocabularies, so a single map would force a rewrite of one renderer's contract.)
// Full academic-style key for the National risk matrix (Figure 4). Spells out
// every encoding on the figure — the colour scale, the National roll-up cell, the
// LIVE/DEMO provenance flag and the trend glyphs — so the exhibit is readable in
// isolation, the way a figure caption in a formal report must be. Shared so the
// HTML and .docx captions are identical.
export const RISK_MATRIX_CAPTION =
  "National risk matrix — sectors (rows) against the National roll-up and all " +
  "provinces (columns), sorted worst-first. Cell colour encodes risk level: " +
  "green = Low, amber = Medium, red = High, black = Critical. The National cell " +
  "states each sector's worst level nationwide and ×N, the number of provinces at " +
  "that level. The pill beside each sector marks its data provenance — LIVE (real " +
  "feed this cycle) or DEMO (seeded placeholder). Trend glyphs show movement since " +
  "the last cycle: ▲ rising (worsening), ▼ falling (improving), — flat (no change).";

export function provincialRiskCaption(provinceCount: number, provincesAtRisk: number): string {
  return (
    `All ${provinceCount} provinces ranked worst-first by their single most-stressed ` +
    `sector. ${provincesAtRisk} of ${provinceCount} sit at HIGH or CRITICAL. ` +
    `"Stressed" counts how many of a province's sectors are at HIGH or CRITICAL.`
  );
}

// Plain-English framing for the Strategic Context section, written for officers
// and executives with no climate-science background. States WHAT this is (global
// risk intelligence from the World Economic Forum) and WHY it sits in the report
// (it shows PNG's local readings are part of a recognised worldwide pattern, which
// strengthens the case for the actions above). Names the honesty contract up front.
export const STRATEGIC_INTRO =
  "The World Economic Forum (WEF) publishes global risk intelligence used by " +
  "governments and businesses worldwide. The items below place this week's PNG " +
  "readings in that wider context — confirming the local risk is part of a " +
  "recognised global pattern and reinforcing why the actions above matter. Each " +
  "item is a plain-language paraphrase of an openly published WEF report, marked " +
  "DEMO (seeded reference, not a live feed) and linked to its public source.";

// A "why it matters here" line per scope, tying WEF's global framing back to PNG's
// situation in language an executive reads at a glance.
const RELEVANCE: Record<string, string> = {
  "National outlook":
    "Sets the whole-of-country backdrop for PNG's ENSO exposure this cycle.",
  "Food Security":
    "PNG is import-exposed and highland-drought-prone — this names food as a front-line risk.",
  "Water Security":
    "Reinforces that water stress needs coordinated, cross-agency action, not a single owner.",
  "Public Health":
    "Flags the disease-outbreak risk that follows drought, flooding and displacement.",
  "Economic Stability":
    "Frames overlapping climate, price and conflict shocks as one compounding pressure on the economy.",
  "Infrastructure":
    "Argues resilience must be built into roads, power and water before the next shock, not after.",
  "Energy Security":
    "Ties energy reliability to the same climate-transition pressures driving this alert.",
  "Social Stability":
    "Links environmental stress to the societal and conflict risks that can follow it.",
  "Disaster & Hazard":
    "Makes the case for funding disaster resilience ahead of the event, while it is cheapest.",
};

function relevanceFor(scope: string): string {
  return RELEVANCE[scope] ?? "Provides strategic context for this week's risk picture.";
}

// Pure selector: choose and order the WEF tiles that earn a place in THIS report.
// National-level tiles always show (they set the frame); a sector tile shows only
// when that sector is actually stressed (HIGH/CRITICAL) in a focus province this
// cycle — so the section stays actionable rather than a generic reading list.
// National tiles lead, then stressed-sector tiles; capped so the report stays tight.
export function selectStrategicContext(
  wef: WefInsight[],
  sectorRisk: SectorRisk[],
  limit = 6,
): SitrepModel["strategic"] {
  const stressedSectors = new Set(
    sectorRisk
      .filter(
        (r) =>
          FOCUS_NAMES[r.province_code] &&
          (r.level === "high" || r.level === "critical"),
      )
      .map((r) => r.sector as string),
  );

  const national = wef.filter((w) => !w.sector);
  const sectoral = wef.filter((w) => w.sector && stressedSectors.has(w.sector));

  return [...national, ...sectoral].slice(0, limit).map((w) => {
    const scope = w.sector ?? "National outlook";
    return {
      title: w.title,
      summary: w.summary,
      relevance: relevanceFor(scope),
      scope,
      source: w.source,
      published: w.published,
      url: w.url,
      provenance: w.provenance,
    };
  });
}
