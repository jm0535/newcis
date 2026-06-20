// Plain-language vocabulary for the national picture, written for non-technical
// readers (officers, executives, the PM). Lives in ONE pure module so the
// dashboard (ExecutiveHeadline, KpiStrip) and the server-rendered SITREP read
// from the same source and can never drift. No React, no I/O.
import type { NationalStatus, AlertLevel } from "./types";
import { FOCUS_COUNT } from "./focus-provinces";

// What each ENSO phase means for PNG, in one sentence — the science made plain.
export const PHASE_PLAIN: Record<NationalStatus["enso_phase"], string> = {
  neutral: "The Pacific is in a neutral state (no El Niño or La Niña)",
  el_nino_watch: "An El Niño is building (drought/frost risk rising)",
  el_nino_alert: "An El Niño is underway (highland drought & frost likely)",
  la_nina_watch: "A La Niña is building (flood risk rising)",
  la_nina_alert: "A La Niña is underway (heavy rain & flooding likely)",
};

// The single instruction to leadership for each alert level.
export const ALERT_ACTION: Record<AlertLevel, string> = {
  GREEN: "Maintain routine monitoring.",
  AMBER: "Brief sector leads and verify cluster readiness.",
  RED: "Pre-position water and health supplies and issue advisories to the focus provinces.",
  BLACK: "Activate the National Emergency Operations Centre now.",
};

// The one sentence the Prime Minister reads first: what's happening, how bad, and
// — when provinces are stressed — how widespread. The recommended action
// (ALERT_ACTION) is appended by the caller so it can be styled separately.
export function bottomLineSentence(national: NationalStatus): string {
  const level = national.alert_level;
  const risk = national.national_risk_rating.toUpperCase();
  const provinces = national.high_risk_province_count;
  return (
    `${PHASE_PLAIN[national.enso_phase]}, but the national alert is ` +
    `${level} and overall risk is ${risk}` +
    (provinces > 0
      ? ` — ${provinces} of the ${FOCUS_COUNT} focus provinces are stressed across multiple sectors.`
      : ".")
  );
}

// Short plain hint shown under each KPI card. Sourced from KpiStrip so the SITREP
// KPI band and the dashboard tiles explain each metric identically.
export const PHASE_HINT: Record<NationalStatus["enso_phase"], string> = {
  neutral: "Pacific in a normal state — no El Niño or La Niña forcing.",
  el_nino_watch: "Conditions building toward El Niño — drought/frost risk rising.",
  el_nino_alert: "El Niño underway — highland drought & frost likely.",
  la_nina_watch: "Conditions building toward La Niña — flood risk rising.",
  la_nina_alert: "La Niña underway — heavy rain & flooding likely.",
};

export const ALERT_HINT: Record<AlertLevel, string> = {
  GREEN: "Routine — normal monitoring.",
  AMBER: "Watch — brief sector leads, verify readiness.",
  RED: "Alert — pre-position supplies, advise focus provinces.",
  BLACK: "Emergency — activate national operations centre.",
};

export const RISK_HINT: Record<NationalStatus["national_risk_rating"], string> = {
  low: "Few sectors stressed across focus provinces.",
  med: "Several sectors stressed — monitor closely.",
  high: "Many sectors stressed — action needed now.",
  critical: "Widespread severe stress — crisis footing.",
};

// Short phase label for the KPI band cell (not the full sentence).
export const PHASE_SHORT: Record<NationalStatus["enso_phase"], string> = {
  neutral: "Neutral",
  el_nino_watch: "El Niño Watch",
  el_nino_alert: "El Niño Alert",
  la_nina_watch: "La Niña Watch",
  la_nina_alert: "La Niña Alert",
};
