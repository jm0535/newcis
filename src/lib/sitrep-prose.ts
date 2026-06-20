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

// Situation overview — frames the KPI band figure: what the headline numbers say
// and why this posture, in plain terms an executive can act on. Multi-paragraph.
export function situationOverviewParas(m: SitrepModel): string[] {
  const phaseGloss =
    m.enso === "El Niño"
      ? "El Niño conditions in the Pacific tend to bring below-average rainfall and " +
        "drought stress to much of PNG, with the highlands most exposed."
      : m.enso === "La Niña"
        ? "La Niña conditions tend to bring above-average rainfall, raising flood and " +
          "landslide risk in already-wet provinces."
        : "Neutral conditions carry no strong basin-wide signal, so risk is driven " +
          "more by local and sectoral factors than by the Pacific state.";
  const alertGloss =
    m.alert === "BLACK"
      ? "A BLACK level denotes a national emergency footing: the system is calling " +
        "for full activation, not preparation."
      : m.alert === "RED"
        ? "A RED level is an active alert: thresholds have been crossed and early " +
          "action, not just monitoring, is now required."
        : m.alert === "AMBER"
          ? "An AMBER level is a watch: conditions are elevated and warrant closer " +
            "monitoring and readiness checks, short of full activation."
          : "A GREEN level is routine: no operational trigger has been met and the " +
            "standing posture is sufficient.";
  return [
    `The national picture is summarised in the key indicators below. The current ` +
      `ENSO phase is ${m.enso}, the national alert level is ${m.alert}, and overall ` +
      `national risk is rated ${m.rating}. ${m.summary}`,
    `${phaseGloss} ${alertGloss} The figures that follow break this headline down ` +
      `into the underlying climate readings and the provincial and sectoral picture, ` +
      `so the basis for the alert level can be traced rather than taken on trust.`,
  ];
}

// Climate assessment — frames the trend small-multiples + indicator table, and
// explains what the indicators are and how to read them. Multi-paragraph.
export function climateAssessmentParas(m: SitrepModel): string[] {
  const live = m.indicators.filter((i) => i.provenance === "LIVE").length;
  const total = m.indicators.length;
  const coverage = total
    ? `${live} of ${total} climate indicators are sourced live this cycle`
    : "no climate indicators were available this cycle";
  return [
    `The following indicators track the state of the Pacific and its effect on PNG. ` +
      `${capFirst(coverage)}; the remainder are seeded reference values clearly ` +
      `marked DEMO, pending a public feed. Trends are shown over the most recent ` +
      `readings, with the latest value and unit on each chart, and the full set is ` +
      `tabulated beneath.`,
    `The Oceanic Niño Index (ONI) and the Southern Oscillation Index (SOI) are the ` +
      `primary ENSO drivers: ONI measures sea-surface temperature anomaly in the ` +
      `central Pacific, and SOI the atmospheric pressure see-saw that accompanies it. ` +
      `Sea-surface temperature, rainfall and temperature anomalies, soil moisture and ` +
      `vegetation health (NDVI) then translate that basin-wide signal into conditions ` +
      `felt on the ground in PNG.`,
    `Each reading is compared against the documented alert thresholds rather than ` +
      `judged by eye, so the same number always yields the same alert level. Where an ` +
      `indicator is trending toward a threshold, that movement is the early-warning ` +
      `signal this report exists to surface, and is reflected in the recommended ` +
      `actions later in the document.`,
  ];
}

// Provincial assessment — frames the map, matrix and ranked table together, and
// explains the worst-hit-sector colouring. Multi-paragraph.
export function provincialAssessmentParas(m: SitrepModel): string[] {
  const worst = m.provinces[0];
  const lead =
    worst && worst.level !== "—"
      ? `${worst.name} is the most-stressed province this cycle, driven by ${worst.sector} at ${worst.level}.`
      : "No focus province is currently carrying a HIGH or CRITICAL sector.";
  const spread = m.provincesAtRisk
    ? `In total, ${m.provincesAtRisk} of the ${m.provinceCount} provinces assessed sit ` +
      `at HIGH or CRITICAL in at least one sector, which is the concentration of risk ` +
      `that shapes where effort and stocks should be directed.`
    : `No province is currently at HIGH or CRITICAL in any sector, so the provincial ` +
      `picture supports a readiness rather than a response posture.`;
  return [
    `Risk is assessed for every province and mapped to the four-tier scale, with each ` +
      `province coloured by its single worst-hit sector — the principle being that a ` +
      `province is only as safe as its most-stressed sector. ${lead}`,
    `${spread} The risk matrix that follows sets out every sector against every ` +
      `province, so a reader can see not just which provinces are stressed but which ` +
      `sectors are driving that stress, and the ranked table beneath orders provinces ` +
      `worst-first to focus attention where it is most needed.`,
  ];
}

// Sectoral impact — frames the sector-mover list and explains lead-agency
// ownership. Multi-paragraph.
export function sectoralImpactParas(m: SitrepModel): string[] {
  if (!m.movers.length) {
    return [
      `No focus-province sector cell is currently at a level that warrants individual ` +
        `escalation; sector risk remains within routine bounds. Lead agencies should ` +
        `nonetheless sustain their standing monitoring, since a sector can move from ` +
        `routine to stressed within a single cycle if an underlying indicator crosses ` +
        `a threshold.`,
    ];
  }
  return [
    `Across the focus provinces, the sector cells under the most pressure this cycle ` +
      `are listed below, worst-first. Each names the province, the sector, its alert ` +
      `level and the direction of travel since the previous reading, so a lead agency ` +
      `can see at a glance both how bad a cell is and whether it is getting worse.`,
    `Each sector has a designated lead agency, named in the panel, that owns the ` +
      `response for its domain. The direction of travel matters as much as the level: ` +
      `a HIGH cell that is improving needs sustained effort, while a MEDIUM cell that ` +
      `is rising fast may warrant pre-emptive action before it reaches HIGH. These ` +
      `movers are the specific cells the recommended actions are written to address.`,
  ];
}

// Recommended actions — a prose lead-in before the action list, explaining how to
// read the graduated, owner-tagged actions. Multi-paragraph.
export function actionsLeadParas(m: SitrepModel): string[] {
  return [
    `The following actions are recommended for the current alert level (${m.alert}). ` +
      `They are graduated: a higher alert level adds to, rather than replaces, the ` +
      `measures of the level below it, so escalation is a matter of layering on new ` +
      `actions rather than rewriting the plan.`,
    `Each action names the function responsible and, where it matters, the timeframe, ` +
      `so it can be assigned and tracked rather than read as general advice. Provincial ` +
      `coordinators and sector lead agencies should treat the items in their domain as ` +
      `directive for this cycle and report readiness against them at the next ` +
      `inter-agency sync.`,
  ];
}

// Conclusion — closes the document: restates the posture, the watch-point and the
// reissue contract. Multi-paragraph.
export function conclusionParas(m: SitrepModel): string[] {
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
  return [
    `In summary, ${posture} ${watch}. The alert level reflects the documented risk ` +
      `model applied to this cycle's readings, and the recommended actions above are ` +
      `scaled to match it.`,
    `Conditions will be reassessed next cycle and this report reissued, or escalated ` +
      `immediately should an indicator cross an alert threshold before then. Provincial ` +
      `coordinators should confirm readiness against the recommended actions, and sector ` +
      `lead agencies should close out the movers identified in their domain, so that the ` +
      `next report opens from a position of demonstrated preparedness.`,
  ];
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
