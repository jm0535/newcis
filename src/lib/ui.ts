// Visual mappings shared across dashboard components. Centralising these
// guarantees the traffic-light vocabulary stays consistent — change the palette
// in one place, the whole operating picture follows.
import type { AlertLevel, RiskLevel, Trend } from "./types";

// Vibrant traffic-light palette, tuned to stay visible on BOTH the dark UI and
// the light theme / map imagery. "critical"/BLACK is a vibrant violet (the
// "beyond red" emergency colour) — a literal black vanished on dark surfaces.
// Keep in sync with the --status-* tokens in globals.css.
export const RISK_COLOUR: Record<RiskLevel, string> = {
  low: "#22c55e", // green-500
  med: "#fbbf24", // amber-400
  high: "#f43f5e", // rose-500
  critical: "#a855f7", // violet-500
};

export const ALERT_COLOUR: Record<AlertLevel, string> = {
  GREEN: "#22c55e",
  AMBER: "#fbbf24",
  RED: "#f43f5e",
  BLACK: "#a855f7",
};

// Theme-aware pill classes routed through the --status-* tokens so they read in
// both dark and light themes (no hardcoded zinc/emerald that breaks on flip).
export const RISK_BG_CLASS: Record<RiskLevel, string> = {
  low: "bg-status-green/15 text-status-green border-status-green/40",
  med: "bg-status-amber/15 text-status-amber border-status-amber/40",
  high: "bg-status-red/15 text-status-red border-status-red/50",
  critical: "bg-status-black/15 text-status-black border-status-black/50",
};

export const ALERT_BG_CLASS: Record<AlertLevel, string> = {
  GREEN: "bg-status-green/15 text-status-green border-status-green/40",
  AMBER: "bg-status-amber/15 text-status-amber border-status-amber/40",
  RED: "bg-status-red/15 text-status-red border-status-red/50",
  BLACK: "bg-status-black/15 text-status-black border-status-black/50",
};

export const TREND_GLYPH: Record<Trend, string> = {
  up: "▲",
  down: "▼",
  flat: "▬",
};

// Plain-language explainer for each climate/hazard indicator. Written for a dual
// audience: an executive should grasp "what is this and which way is bad" in one
// line; a technical reader gets the same vocabulary the risk engine uses.
//   - plain:  one sentence, no jargon — what the signal actually tells us.
//   - danger: which direction escalates the alert (drives the caption + arrow).
// `dangerLabel` is the human phrasing of that direction shown next to the chart.
export interface IndicatorMeta {
  plain: string;
  danger: "high" | "low" | "extreme"; // up=high, down=low, away-from-zero=extreme
  dangerLabel: string;
}

export const INDICATOR_META: Record<string, IndicatorMeta> = {
  ONI: {
    plain:
      "The master El Niño / La Niña dial — Pacific Ocean temperature that drives PNG's drought and flood seasons.",
    danger: "extreme",
    dangerLabel: "Far from 0 is dangerous — high = El Niño (drought), very low = La Niña (floods).",
  },
  SST_ANOM_NINO34: {
    plain: "Sea-surface temperature anomaly in the Niño-3.4 region — the raw ENSO ocean signal.",
    danger: "extreme",
    dangerLabel: "Far from 0 is dangerous in either direction.",
  },
  RAINFALL_ANOM: {
    plain: "How far rainfall is above or below normal across the focus provinces.",
    danger: "low",
    dangerLabel: "Falling / negative is dangerous — a drought signal.",
  },
  SOIL_MOISTURE: {
    plain: "How wet the root-zone soil is versus a normal year — feeds crops and water supply.",
    danger: "low",
    dangerLabel: "Falling is dangerous — crops and water under stress.",
  },
  TEMP_ANOM: {
    plain: "How many degrees hotter or cooler than the seasonal normal it has been.",
    danger: "high",
    dangerLabel: "Rising heat is dangerous — health stress, evaporation, fire risk.",
  },
  SEISMIC: {
    plain:
      "Count of magnitude-4.5+ earthquakes in PNG over 30 days — PNG sits on the Ring of Fire.",
    danger: "high",
    dangerLabel: "Rising count is dangerous — more shaking, higher disaster risk.",
  },
  NDVI: {
    plain: "Satellite vegetation health — greener crops and forest read higher.",
    danger: "low",
    dangerLabel: "Falling is dangerous — drying or failing vegetation.",
  },
  SOI: {
    plain: "Southern Oscillation Index — atmospheric pressure see-saw that confirms ENSO phase.",
    danger: "low",
    dangerLabel: "Strongly negative is dangerous — reinforces El Niño.",
  },
};

// PNG runs on Port Moresby time (UTC+10, no daylight saving). Stored timestamps
// are UTC (correct for the data layer); we DISPLAY them in national time so a
// reader in PNG sees their own wall clock, not a UTC value that looks "behind".
// "PGT" = Papua New Guinea Time.
const PNG_TZ = "Pacific/Port_Moresby";

const PNG_DATETIME_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: PNG_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function fmtDateTime(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  // en-GB gives "04/06/2026, 18:27"; normalise to "2026-06-04 18:27 PGT".
  const parts = PNG_DATETIME_FMT.formatToParts(d);
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${p("year")}-${p("month")}-${p("day")} ${p("hour")}:${p("minute")} PGT`;
}
