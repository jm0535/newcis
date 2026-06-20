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
export const CLASSIFICATION = "OFFICIAL: FOR PLANNING USE";
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
// team understands what the report is, how often it comes, and how to trust it.
// Defines "cycle" up front because the whole report is dated against it.
export function introductionParas(m: SitrepModel): string[] {
  return [
    `This Situation Report covers the period ${m.period}. It gives national ` +
      `leadership, sector lead agencies and provincial coordinators a single, ` +
      `consolidated picture of El Niño and La Niña conditions, known together as the ` +
      `El Niño Southern Oscillation (ENSO), and their assessed impact on Papua New ` +
      `Guinea. Its purpose is to let government act ahead of a climate shock rather ` +
      `than in response to one, when action is cheaper and lives and livelihoods are ` +
      `easier to protect.`,
    `A note on timing, because the report refers to it throughout. A "cycle" is one ` +
      `reporting cycle: this report is produced once a week, and each edition is one ` +
      `cycle. "This cycle" means the week covered by this report, ${m.period}. "Next ` +
      `cycle" means the following week, when the underlying data is refreshed and this ` +
      `report is reissued with updated readings. Behind the scenes the data feeds ` +
      `themselves are pulled several times a day, so the weekly report always rests on ` +
      `current observations; if conditions cross an alert threshold between weekly ` +
      `editions, the report is reissued immediately rather than held to the schedule.`,
    `The assessment combines live climate indicators (ocean and atmosphere ` +
      `observations) with humanitarian datasets, and runs them through a fixed, ` +
      `documented risk model that produces a four-tier alert level: GREEN for routine, ` +
      `AMBER for watch, RED for alert, and BLACK for national emergency. Every figure ` +
      `in this report carries one of two honesty marks. LIVE means the value was ` +
      `pulled from a real data feed this cycle. DEMO means a representative stand-in ` +
      `value is shown in place of a feed that has no public interface yet, so the ` +
      `report is never silently padded with invented numbers. Overall data confidence ` +
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
  const spread =
    m.provincesAtRisk > 0
      ? `${m.provincesAtRisk} of the ${m.provinceCount} provinces assessed are ` +
        `carrying at least one sector at HIGH or CRITICAL, so the response effort has ` +
        `a clear set of places to concentrate on.`
      : `No province is currently carrying a sector at HIGH or CRITICAL, so the task ` +
        `this cycle is to stay ready rather than to respond.`;
  return [
    `The national picture is captured in six headline readings, shown in the ` +
      `key-indicator band below (Figure 1). The current ENSO phase is ${m.enso}, the ` +
      `national alert level is ${m.alert}, and overall national risk is rated ` +
      `${m.rating}. ${m.summary}`,
    `What this means in plain terms: ${lowerFirst(phaseGloss)} ${alertGloss} These ` +
      `two readings, the state of the Pacific and the alert level it drives, are the ` +
      `spine of the whole report. Everything that follows is an expansion of them: ` +
      `which ocean and weather signals produced this alert, which provinces and ` +
      `sectors feel it most, and what each part of government should do about it.`,
    `${spread} The affected-population estimate and the count of high-risk provinces ` +
      `in the band are deliberately conservative planning figures, not casualty counts; ` +
      `they size the problem so resourcing decisions can be made early. The rest of ` +
      `this report exists so the alert level can be traced back to its evidence rather ` +
      `than taken on trust, and so each reader can find the part that is theirs to act on.`,
  ];
}

// Climate assessment — frames the trend small-multiples + indicator table, and
// explains every indicator in plain terms: what the acronym means, what the
// number measures, the unit, how to read the chart, and what it implies for PNG.
// Written so a reader with no climate-science background can follow it. The five
// indicator paragraphs mirror the five charts in Figure 2, in the same order.
export function climateAssessmentParas(m: SitrepModel): string[] {
  const live = m.indicators.filter((i) => i.provenance === "LIVE").length;
  const total = m.indicators.length;
  const coverage = total
    ? `${live} of ${total} climate indicators are sourced live this cycle`
    : "no climate indicators were available this cycle";
  return [
    `This section reads the climate signals that drive PNG's risk. Each chart in ` +
      `Figure 2 shows one indicator's recent trend, with its latest value and unit ` +
      `printed above the line; a rising or falling line is the early-warning signal ` +
      `this report exists to surface. ${capFirst(coverage)}; the remainder are ` +
      `seeded reference values clearly marked DEMO, pending a public feed. Every ` +
      `reading is compared against fixed, documented thresholds, not judged by eye, ` +
      `so the same number always yields the same alert level. The five indicators ` +
      `below are explained in turn, in the order they appear in Figure 2.`,
    `Projected ONI (Oceanic Niño Index, forecast). The ONI is the world's standard ` +
      `measure of El Niño and La Niña. It is the sea-surface temperature anomaly (how ` +
      `far above or below normal the ocean is, in degrees Celsius) averaged over the ` +
      `central Pacific "Niño 3.4" region. The projected value is a forecast of where ` +
      `the ONI is heading, taken from a multi-model ensemble (many climate models run ` +
      `together). Read it simply: above +0.5 °C signals El Niño (drought risk for PNG, ` +
      `worst in the highlands); below −0.5 °C signals La Niña (excess-rain, flood and ` +
      `landslide risk); in between is neutral. A rising projected ONI is the single ` +
      `most important early warning of a drought-driving El Niño building ahead.`,
    `Rainfall anomaly. This is how far rainfall across the assessed provinces sits ` +
      `from the long-term average, expressed as a percentage deviation. Zero means ` +
      `normal; a negative figure means drier than usual, a positive figure wetter. For ` +
      `PNG the negative side is the dangerous one: a sustained rainfall deficit dries ` +
      `soils, stresses subsistence gardens and shrinks the water supply, which is the ` +
      `chain that turns an ocean signal into a food- and water-security emergency. A ` +
      `falling line here is the on-the-ground confirmation that an El Niño forecast is ` +
      `already biting.`,
    `Oceanic Niño Index (current). Where the projected ONI looks ahead, this is the ` +
      `latest observed ONI: the same Niño 3.4 sea-surface temperature anomaly in °C, ` +
      `but measured rather than forecast, as a three-month running mean. Reading it is ` +
      `identical: above +0.5 °C is El Niño territory, below −0.5 °C is La Niña, the ` +
      `band between is neutral. Comparing the current value against the projection ` +
      `shows whether conditions are tracking, exceeding or falling short of the ` +
      `forecast, which is what tells leadership whether to hold, escalate or stand down.`,
    `Seismic tempo. This indicator counts magnitude-4.5-and-above earthquakes in PNG ` +
      `over the last 30 days. It is not an ENSO measure (PNG sits on an active plate ` +
      `boundary), but it is carried here because seismic events compound a climate ` +
      `shock: they damage roads, water lines and health posts exactly when a drought ` +
      `or flood response needs them, and can trigger landslides on rain-saturated ` +
      `slopes. A rising count is a standing reminder that the disaster-and-hazard ` +
      `sector can be hit independently of, or on top of, the ENSO picture.`,
    `Temperature anomaly. This is how far air temperature across the focus provinces ` +
      `sits above or below the recent normal, in degrees Celsius. A persistent positive ` +
      `anomaly accelerates evaporation and heat stress, deepening any rainfall deficit ` +
      `and adding a direct public-health load through heat and disease. Read alongside ` +
      `the rainfall anomaly, it separates a hot-and-dry pattern (the classic El Niño ` +
      `drought signature for PNG) from a merely dry or merely warm one, which matters ` +
      `for how hard and how fast the highland provinces will be hit.`,
    `Taken together, these readings are summarised in Table 1, which lists every ` +
      `indicator with its exact value, unit, source and observation date, so any chart ` +
      `in Figure 2 can be checked against its underlying number. Where an indicator is ` +
      `trending toward a threshold, that movement flows directly into the provincial ` +
      `and sectoral assessment that follows and into the recommended actions at the end ` +
      `of this report.`,
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
    `Risk is assessed for every province and graded on the four-tier traffic-light ` +
      `scale: green Low, amber Medium, red High, black Critical. The map in Figure 3 ` +
      `colours each province by its single worst-hit sector, on the principle that a ` +
      `province is only as safe as its most-stressed sector: one red sector turns the ` +
      `whole province red, even if its other sectors are green. Read the map for the ` +
      `geography of risk: where on the map of PNG the pressure is concentrated. ` +
      `${lead}`,
    `Figure 4, the national risk matrix, is the detail behind the map. It is a grid ` +
      `with one row per sector and one column per province, plus a leading "National" ` +
      `column that rolls each sector up to its worst level nationwide and the number of ` +
      `provinces at that level. Each cell is coloured on the same green-to-black scale ` +
      `and carries a small trend glyph: ▲ worsening, ▼ improving, — no change since ` +
      `last cycle. Read a row across to see which provinces are dragging a sector down; ` +
      `read a column down to see which sectors are stressing a province. The LIVE or ` +
      `DEMO pill beside each sector name states whether that row rests on a real feed ` +
      `or a seeded placeholder, so confidence can be weighed cell by cell.`,
    `${spread} Table 2 then ranks all ${m.provinceCount} provinces worst-first, naming ` +
      `each province's worst sector, its level, and a "stressed" count of how many of ` +
      `its sectors sit at HIGH or CRITICAL. Where the map shows where risk is and the ` +
      `matrix shows what is driving it, the table gives leadership a single ordered ` +
      `priority list: the provinces at the top are where effort, stocks and attention ` +
      `should go first.`,
  ];
}

// Sectoral impact — frames the sector-mover list and explains lead-agency
// ownership. Multi-paragraph.
export function sectoralImpactParas(m: SitrepModel): string[] {
  if (!m.movers.length) {
    return [
      `This section tracks risk at the level a single agency can act on: one sector ` +
        `inside one province. Where the provincial assessment above answers "which ` +
        `provinces are under pressure", this section answers "which part of government ` +
        `owns the response, and what exactly is moving". It exists so that a finding ` +
        `does not sit unowned: every sector named here maps to a named lead agency that ` +
        `is accountable for acting on it.`,
      `This cycle, no focus-province sector cell is at a level that warrants individual ` +
        `escalation; sector risk remains within routine bounds. That is a genuine ` +
        `result, not an absence of data: the indicators were read and none crossed the ` +
        `threshold that would single a sector out for action. Lead agencies should ` +
        `nonetheless sustain their standing monitoring, since a sector can move from ` +
        `routine to stressed within a single cycle if an underlying indicator crosses ` +
        `a threshold, and an early move is far cheaper to manage than a late one.`,
    ];
  }
  return [
    `This section tracks risk at the level a single agency can act on: one sector ` +
      `inside one province. Where the provincial assessment above answers "which ` +
      `provinces are under pressure", this section answers "which part of government ` +
      `owns the response, and what exactly is moving". It is written for sector lead ` +
      `agencies, so each can find its own line without reading the whole report.`,
    `Across the focus provinces, the sector cells under the most pressure this cycle ` +
      `are listed below, worst-first. Each entry names the province, the sector, its ` +
      `alert level and the direction of travel since the previous reading, so a lead ` +
      `agency can see at a glance both how bad a cell is and whether it is getting ` +
      `worse. "Worst-first" means the most urgent cell is at the top of the list, so ` +
      `attention and stocks can be committed in order without further triage.`,
    `Each sector has a designated lead agency, named in the panel, that owns the ` +
      `response for its domain: Food Security to the agriculture and food-relief lead, ` +
      `Water Security to the water authority, Public Health to the health department, ` +
      `and so on. Naming the owner is the point of the section. A risk that is everyone's ` +
      `concern but no one's responsibility is the risk that goes unmanaged, so each cell ` +
      `below is deliberately attached to the single body answerable for it this cycle.`,
    `The direction of travel matters as much as the level. A HIGH cell that is improving ` +
      `needs sustained effort to hold the gain, while a MEDIUM cell that is rising fast ` +
      `may warrant pre-emptive action before it reaches HIGH, when the response is still ` +
      `cheap and the lead time is longest. These movers are the specific cells the ` +
      `recommended actions at the end of this report are written to address, so a lead ` +
      `agency reading its line here can turn straight to the action assigned to it.`,
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
    `In summary, ${posture} ${watch}. The alert level is not a judgement call: it ` +
      `reflects the documented risk model applied to this cycle's readings, and the ` +
      `recommended actions above are scaled to match it. Read this report as a single ` +
      `chain of reasoning, from the state of the Pacific, through the indicators it ` +
      `drives, to the provinces and sectors that feel it, and finally to what each part ` +
      `of government should do. Every step is traceable back to the evidence behind it.`,
    `What this means for each reader is concrete. National leadership has the one-glance ` +
      `posture and the affected-population estimate it needs to brief upward and to ` +
      `decide whether to release resources early. Provincial coordinators have a ranked ` +
      `priority list naming where effort and stocks should go first. Sector lead agencies ` +
      `have the specific cells in their domain that are moving, and the action assigned ` +
      `to each. The global findings in the strategic-context section confirm that this ` +
      `is not a local anomaly but part of a pattern the wider world is already acting on, ` +
      `which is why acting early here is prudent rather than premature.`,
    `Conditions will be reassessed next cycle, one week from now, and this report ` +
      `reissued with refreshed readings; should an indicator cross an alert threshold ` +
      `before then, the report is escalated and reissued immediately rather than held to ` +
      `the weekly schedule. Between now and the next edition, provincial coordinators ` +
      `should confirm readiness against the recommended actions, and sector lead agencies ` +
      `should close out the movers identified in their domain, so that the next report ` +
      `opens from a position of demonstrated preparedness rather than from a standing ` +
      `start. Early action, taken while a shock is still forming, is the entire purpose ` +
      `of this system.`,
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
