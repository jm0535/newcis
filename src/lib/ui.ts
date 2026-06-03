// Visual mappings shared across dashboard components. Centralising these
// guarantees the traffic-light vocabulary stays consistent — change the palette
// in one place, the whole operating picture follows.
import type { AlertLevel, RiskLevel, Trend } from "./types";

export const RISK_COLOUR: Record<RiskLevel, string> = {
  low: "#22c55e", // green-500
  med: "#f59e0b", // amber-500
  high: "#ef4444", // red-500
  critical: "#000000",
};

export const ALERT_COLOUR: Record<AlertLevel, string> = {
  GREEN: "#22c55e",
  AMBER: "#f59e0b",
  RED: "#ef4444",
  BLACK: "#000000",
};

export const RISK_BG_CLASS: Record<RiskLevel, string> = {
  low: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  med: "bg-amber-500/20 text-amber-300 border-amber-500/50",
  high: "bg-red-500/25 text-red-300 border-red-500/60",
  critical: "bg-black text-zinc-100 border-zinc-100/60",
};

export const ALERT_BG_CLASS: Record<AlertLevel, string> = {
  GREEN: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  AMBER: "bg-amber-500/20 text-amber-300 border-amber-500/50",
  RED: "bg-red-500/25 text-red-300 border-red-500/60",
  BLACK: "bg-black text-zinc-100 border-zinc-100/60",
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
