// Narrative prose for the SITREP. A government situation report is read as a
// document, not a dashboard — so every figure and table sits inside explanatory
// paragraphs that state what the reader is looking at and what it means. These
// pure functions turn the structured SitrepModel into those paragraphs, and live
// in ONE module so the HTML view (sitrep.ts) and the editable .docx export
// (sitrep-docx.ts) narrate the report identically and can never drift.
//
// No React, no I/O, no markup — each function returns plain strings (one per
// paragraph). The renderers wrap them in their own <p> / Paragraph primitives.
import type { SitrepModel } from "./types";
import { FOCUS_COUNT } from "./focus-provinces";

// The standing issuing authority and classification line. A real government
// SITREP carries both; at PoC scale these are fixed, honest placeholders.
export const ISSUING_AUTHORITY =
  "National Security Advisory · National ENSO Early Warning and Climate Intelligence System (NEWCIS)";
export const CLASSIFICATION = "OFFICIAL — FOR PLANNING USE";
export const DISTRIBUTION =
  "National Security Advisory; Provincial Disaster Coordinators; Sector Lead Agencies.";

// Executive Summary — the BLUF (bottom line up front). One tight paragraph an
// executive can read in isolation: the headline read, then the spread, then the
// single most-important instruction. Built from the model's existing exec fields
// so it never contradicts the dashboard.
export function executiveSummary(m: SitrepModel): string {
  const lead = m.bottomLine || "No national status was available for this cycle.";
  const spread = m.provincesAtRisk
    ? `Of the ${m.provinceCount} provinces assessed, ${m.provincesAtRisk} sit at HIGH or CRITICAL across one or more sectors.`
    : `None of the ${m.provinceCount} provinces assessed currently sit at HIGH or CRITICAL.`;
  const steer = m.actions[0]
    ? `The priority action this cycle is to ${lowerFirst(stripPeriod(m.actions[0]))}.`
    : "No operational triggers were met this cycle; routine monitoring continues.";
  return `${lead} ${spread} ${steer}`;
}

// Introduction — states purpose, scope and method so a reader outside the data
// team understands what the report is and how to trust it. Two paragraphs.
export function introductionParas(m: SitrepModel): string[] {
  return [
    `This Situation Report covers the period ${m.period}. It provides national ` +
      `leadership and provincial coordinators with a consolidated picture of El ` +
      `Niño–Southern Oscillation (ENSO) conditions and their assessed impact on ` +
      `Papua New Guinea, so that early action can be taken ahead of, rather than ` +
      `in response to, a climate shock.`,
    `The assessment draws on live climate indicators (ocean and atmosphere ` +
      `observations) and humanitarian datasets, combined through a fixed, ` +
      `documented risk model into a four-tier alert system (GREEN routine, AMBER ` +
      `watch, RED alert, BLACK emergency). Every figure is marked LIVE where it is ` +
      `pulled from a real feed this cycle, or DEMO where a representative value is ` +
      `used in place of a feed that has no public interface yet. Data confidence ` +
      `this cycle is ${m.confidence.level}: ${lowerFirst(m.confidence.line)}`,
  ];
}

// Situation overview — frames the KPI band figure: what the headline numbers say.
export function situationOverviewPara(m: SitrepModel): string {
  return (
    `The national picture is summarised in the key indicators below. The current ` +
    `ENSO phase is ${m.enso}, the national alert level is ${m.alert}, and overall ` +
    `national risk is rated ${m.rating}. ${
      m.summary
    }`
  );
}

// Climate assessment — frames the trend small-multiples + indicator table.
export function climateAssessmentPara(m: SitrepModel): string {
  const live = m.indicators.filter((i) => i.provenance === "LIVE").length;
  const total = m.indicators.length;
  const coverage = total
    ? `${live} of ${total} climate indicators are sourced live this cycle`
    : "no climate indicators were available this cycle";
  return (
    `The following indicators track the state of the Pacific and its effect on ` +
    `PNG. ${capFirst(coverage)}; the remainder are seeded reference values pending ` +
    `a public feed. Trends are shown over the most recent readings, with the ` +
    `latest value and unit on each chart, and the full set is tabulated beneath.`
  );
}

// Provincial assessment — frames the map, matrix and ranked table together.
export function provincialAssessmentPara(m: SitrepModel): string {
  const worst = m.provinces[0];
  const lead = worst && worst.level !== "—"
    ? `${worst.name} is the most-stressed province this cycle, driven by ${worst.sector} at ${worst.level}.`
    : "No focus province is currently carrying a HIGH or CRITICAL sector.";
  return (
    `Risk is assessed for every province and mapped to the four-tier scale, with ` +
    `each province coloured by its single worst-hit sector. ${lead} The risk ` +
    `matrix sets out all sectors against all provinces, and the table that follows ` +
    `ranks provinces worst-first to focus attention where it is most needed.`
  );
}

// Sectoral impact — frames the sector-mover list.
export function sectoralImpactPara(m: SitrepModel): string {
  return m.movers.length
    ? `Across the focus provinces, the sector cells under the most pressure this ` +
        `cycle are listed below, worst-first. Each names the province, the sector, ` +
        `its alert level and the direction of travel since the previous reading.`
    : `No focus-province sector cell is currently at a level that warrants ` +
        `individual escalation; sector risk remains within routine bounds.`;
}

// Recommended actions — a prose lead-in before the action list.
export function actionsLeadPara(m: SitrepModel): string {
  return (
    `The following actions are recommended for the current alert level (${m.alert}). ` +
    `They are graduated: a higher alert level adds to, rather than replaces, the ` +
    `measures of the level below it.`
  );
}

// Conclusion — closes the document: restates the posture and the watch-point.
export function conclusionPara(m: SitrepModel): string {
  const posture =
    m.alert === "BLACK"
      ? "PNG is on an emergency footing"
      : m.alert === "RED"
        ? "PNG is on alert"
        : m.alert === "AMBER"
          ? "PNG is on watch"
          : "PNG remains in a routine posture";
  const watch =
    m.provincesAtRisk > 0
      ? `with ${m.provincesAtRisk} of the ${FOCUS_COUNT} focus provinces stressed`
      : "with no focus province currently stressed";
  return (
    `In summary, ${posture} ${watch}. Conditions will be reassessed next cycle, ` +
    `and this report reissued, or escalated immediately should an indicator cross ` +
    `an alert threshold. Provincial coordinators should confirm readiness against ` +
    `the recommended actions above.`
  );
}

// --- small text utilities ---------------------------------------------------

function capFirst(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}
function stripPeriod(s: string): string {
  return s.replace(/\.\s*$/, "");
}
