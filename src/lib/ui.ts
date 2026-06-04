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

export function fmtDateTime(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}
