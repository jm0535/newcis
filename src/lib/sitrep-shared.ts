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
  "National risk matrix: sectors (rows) against the National roll-up and all " +
  "provinces (columns), sorted worst-first. Cell colour encodes risk level: " +
  "green = Low, amber = Medium, red = High, black = Critical. The National cell " +
  "states each sector's worst level nationwide and ×N, the number of provinces at " +
  "that level. The pill beside each sector marks its data provenance: LIVE (real " +
  "feed this cycle) or DEMO (seeded placeholder). Trend glyphs show movement since " +
  "the last cycle: ▲ rising (worsening), ▼ falling (improving), — flat (no change).";

// Schematic — the decision-pipeline diagram in the Introduction. States the five
// stages and that every section maps onto one, so a non-technical reader sees the
// whole chain of reasoning before reading any section. Shared so the HTML and the
// .docx caption it identically.
export const PIPELINE_SCHEMATIC_CAPTION =
  "How the report reasons, in five stages: the state of the Pacific (El Niño, La " +
  "Niña or Neutral) drives the climate indicators; the indicators are graded by a " +
  "fixed, documented risk engine; the grades identify which provinces and sectors " +
  "are stressed; and that picture sets the recommended actions, naming who acts and " +
  "by when. Every section of this report sits at one of these five stages, so a " +
  "reader can place any figure or table in the chain from cause to decision.";

// Figure 1 — the KPI band. Spells out every tile and the two vocabularies on it
// (the four-tier alert words and the risk rating) so the band reads in isolation.
export const KPI_BAND_CAPTION =
  "National key-indicator band: the six headline readings that summarise the cycle: " +
  "ENSO phase (El Niño, La Niña or Neutral, the state of the Pacific); national alert " +
  "level on the four-tier scale (GREEN routine, AMBER watch, RED alert, BLACK " +
  "emergency); overall national risk rating; estimated affected population; the count " +
  "of high-risk provinces; and the forecast period the assessment covers. Together " +
  "these are the one-glance executive summary expanded in the sections that follow.";

// Figure 2 — the trend small-multiples. Explains what a single chart shows and how
// to read the line, since the per-indicator meaning is detailed in the prose above.
export const TREND_FIGURE_CAPTION =
  "Recent trend per climate indicator: one small chart each, in the order the text " +
  "explains them. Each chart's title names the indicator and its title line shows the " +
  "latest value with its unit (°C for temperature anomalies, % for rainfall deviation, " +
  "a count for seismic events). The line traces the most recent readings left-to-right, " +
  "so its slope is the signal: a rising or falling line means conditions are moving, " +
  "and the direction is read against each indicator's meaning given above.";

// Figure 3 — the provincial risk map. Spells out the colour key and the worst-hit
// rule so the map's geography of risk is unambiguous.
export const MAP_FIGURE_CAPTION =
  "Provincial risk map: each province shaded by its single worst-hit sector on the " +
  "four-tier scale (green = Low, amber = Medium, red = High, black = Critical). A " +
  "province takes the colour of its most-stressed sector alone, so one High sector " +
  "shades the whole province red even where its other sectors are calm. Read the map " +
  "for where on PNG the pressure sits; the matrix and table that follow give the " +
  "sector-by-sector detail behind each province's colour.";

// Table 1 — the climate-indicator table. States exactly what each column means and
// why the table sits beside Figure 2 (it is the auditable number behind each chart).
export const INDICATOR_TABLE_CAPTION =
  "Climate indicators this cycle: the exact figure behind every chart in Figure 2. " +
  "Columns give each indicator's key and plain-language label, its current value and " +
  "unit, the data source, and the observation date, plus a provenance mark: LIVE " +
  "(pulled from a real feed this cycle) or DEMO (a seeded reference value standing in " +
  "for a feed with no public interface yet). This table is the audit trail; it lets a " +
  "reader confirm any chart against its underlying number and judge how much of the " +
  "assessment rests on live data.";

// Table 3 — the data-feed status table in the technical annex.
export const FEED_TABLE_CAPTION =
  "Data-feed status this ingest cycle: one row per source the system attempted to " +
  "pull, with OK where the feed returned current data and FAIL where it did not. A " +
  "failed feed does not blank the report: the affected indicator falls back to its " +
  "last-good or seeded value and is marked accordingly, so leadership can see precisely " +
  "how complete this cycle's evidence base is.";

export function provincialRiskCaption(provinceCount: number, provincesAtRisk: number): string {
  return (
    `All ${provinceCount} provinces ranked worst-first by their single ` +
    `most-stressed sector. For each province the table names its worst sector, that ` +
    `sector's level on the four-tier scale, and a "stressed" count of how many of the ` +
    `province's sectors sit at HIGH or CRITICAL. ${provincesAtRisk} of ${provinceCount} ` +
    `provinces are at HIGH or CRITICAL in at least one sector this cycle. The provinces ` +
    `at the top of this list are the priority for effort, stocks and attention.`
  );
}

// Plain-English framing for the Strategic Context section, written for officers
// and executives with no climate-science background. States WHAT this is (global
// risk intelligence from the World Economic Forum) and WHY it sits in the report
// (it shows PNG's local readings are part of a recognised worldwide pattern, which
// strengthens the case for the actions above). Names the honesty contract up front.
export const STRATEGIC_INTRO =
  "The World Economic Forum (WEF) is an independent international body whose annual " +
  "Global Risks Report and related analyses are used by governments and businesses " +
  "worldwide to frame long-term risk. This section exists to answer a question an " +
  "executive will rightly ask: is PNG's situation a local anomaly, or part of a " +
  "pattern the rest of the world is also acting on? Each item below is a WEF finding, " +
  "paired with a \"why it matters here\" line that ties it directly to a specific " +
  "NEWCIS indicator or sector, so the global framing is not abstract commentary but " +
  "an external check on the same risks this report tracks. The tiles are selected to " +
  "match this cycle: national-outlook items always appear to set the backdrop, and a " +
  "sector item appears only when that sector is actually stressed (HIGH or CRITICAL) " +
  "in a focus province now. Every item is marked DEMO (a seeded reference drawn from " +
  "an openly published WEF report, not a live feed) and is linked to its public " +
  "source so any reader can verify it.";

// A "why it matters here" line per scope, tying each WEF item back to the specific
// NEWCIS indicator or sector it speaks to, and what that implies for PNG. Written
// so an executive sees the global finding and its concrete local hook in one read,
// not a generic "this is relevant" gesture.
const RELEVANCE: Record<string, string> = {
  "National outlook":
    "Links to NEWCIS's national alert level and the ONI/SOI ENSO drivers in Section 3: " +
    "it confirms PNG's whole-of-country ENSO exposure this cycle is part of a worldwide " +
    "pattern, which is why the national posture above is justified rather than alarmist.",
  "Food Security":
    "Links to the Food Security sector and the rainfall- and temperature-anomaly " +
    "indicators: PNG is import-exposed and its highland subsistence gardens are " +
    "drought-prone, so a global food-risk finding maps directly onto the provinces this " +
    "report already flags, making food a front-line sector for early action.",
  "Water Security":
    "Links to the Water Security sector and the soil-moisture and rainfall-anomaly " +
    "indicators: it reinforces that a rainfall deficit becomes a water-supply crisis " +
    "that no single agency owns, so the cross-agency coordination in the actions above " +
    "is the right response, not an optional extra.",
  "Public Health":
    "Links to the Public Health sector and the temperature-anomaly indicator: it flags " +
    "the disease-outbreak and heat-stress load that follows drought, flooding and " +
    "displacement, which is the chain that turns a climate signal into a health-system " +
    "burden on the provinces named here.",
  "Economic Stability":
    "Links to the Economic Stability sector and the food-price feed: it frames " +
    "overlapping climate, price and conflict shocks as one compounding pressure, " +
    "explaining why a single bad ENSO cycle can move several NEWCIS sectors at once " +
    "rather than just one.",
  "Infrastructure":
    "Links to the Infrastructure sector and the seismic-tempo indicator: it argues " +
    "resilience must be built into roads, power and water before the next shock, which " +
    "is exactly the infrastructure that a drought response, or a compounding earthquake, " +
    "depends on in PNG's terrain.",
  "Energy Security":
    "Links to the Energy Security sector: it ties energy reliability to the same " +
    "climate-transition pressures driving this alert, a reminder that power supply " +
    "underpins the water, health and communications the rest of the response needs.",
  "Social Stability":
    "Links to the Social Stability sector and the conflict-events feed: it connects " +
    "environmental stress to the displacement and conflict risk that can follow it, the " +
    "societal dimension of an ENSO shock that NEWCIS tracks alongside the physical one.",
  "Disaster & Hazard":
    "Links to the Disaster & Hazard sector and the seismic-tempo indicator: WEF's " +
    "finding that early warning can sharply cut disaster damage is the direct case for " +
    "NEWCIS itself: funding resilience and early action ahead of the event, while it " +
    "is cheapest, is the mission this report serves.",
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
