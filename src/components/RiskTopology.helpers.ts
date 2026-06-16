/**
 * Pure helpers + layout constants for <RiskTopology>. Split out of the component
 * file to keep that file focused on rendering and under the size budget. Nothing
 * here touches React or the DOM — it is deterministic geometry, colour mapping,
 * label placement, and the severity vocabulary for the firing edges.
 */
import type { TopoNode } from "@/lib/topology";
import { ALERT_COLOUR, RISK_COLOUR } from "@/lib/ui";

// ----- SVG canvas + ring geometry -----
export const W = 760;
export const H = 620;
export const CX = W / 2;
export const CY = H / 2;
export const R_INNER = 150; // indicator ring radius
export const R_OUTER = 270; // sector ring radius

/**
 * Severity rank of an edge's level on a single 0–3 scale, spanning BOTH the alert
 * vocabulary (GREEN/AMBER/RED/BLACK, on driver & rollup spokes) and the risk
 * vocabulary (low/med/high/critical, on sector edges). 0 = routine, 3 = emergency.
 * Drives how a lit edge fires: green/low (0) stay dark, amber/med up fire faster
 * and brighter with severity.
 */
export function edgeSeverity(level: string): 0 | 1 | 2 | 3 {
  switch (level) {
    case "BLACK":
    case "critical":
      return 3;
    case "RED":
    case "high":
      return 2;
    case "AMBER":
    case "med":
      return 1;
    default:
      return 0; // GREEN / low / unknown
  }
}

// Per-severity firing profile. Higher severity = faster sweep (shorter duration),
// fatter spark, stronger glow — so tempo and brightness read as urgency. Severity
// 0 never fires (green = all-clear, kept dark to preserve traffic-light signal).
export const SPARK_PROFILE: Record<1 | 2 | 3, { dur: number; width: number; glow: number }> = {
  1: { dur: 2.6, width: 2, glow: 2.5 }, // AMBER / med — slow, gentle
  2: { dur: 1.6, width: 2.5, glow: 3.5 }, // RED / high — brisk
  3: { dur: 1.0, width: 3, glow: 5 }, // BLACK / critical — rapid, hot
};

/** Colour for any node: indicators/centre use AlertLevel, sectors use RiskLevel. */
export function nodeColour(n: TopoNode): string {
  if (n.kind === "sector") {
    return RISK_COLOUR[n.level as keyof typeof RISK_COLOUR] ?? RISK_COLOUR.low;
  }
  return ALERT_COLOUR[n.level as keyof typeof ALERT_COLOUR] ?? ALERT_COLOUR.GREEN;
}

/**
 * Colour for an edge: a sector-source edge (rollup, cascade) takes the source
 * sector's RiskLevel colour; a spoke (driver/attributed) takes its own AlertLevel
 * colour. `sourceLevel` is the source node's level (used only when the source is a
 * sector); `edgeLevel` is the edge's own level (used otherwise).
 */
export function edgeColour(sourceIsSector: boolean, sourceLevel: string, edgeLevel: string): string {
  if (sourceIsSector) {
    return RISK_COLOUR[sourceLevel as keyof typeof RISK_COLOUR] ?? RISK_COLOUR.low;
  }
  return ALERT_COLOUR[edgeLevel as keyof typeof ALERT_COLOUR] ?? ALERT_COLOUR.GREEN;
}

/** Place ring nodes evenly around the circle, first node at the top (−90°). */
export function ringPosition(i: number, count: number, radius: number) {
  const angle = (i / Math.max(count, 1)) * 2 * Math.PI - Math.PI / 2;
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
}

/**
 * Place a node's label radially OUTWARD from the centre, so text fans away from
 * the hub instead of piling on top of it. The anchor/baseline follow the angle:
 * labels on the right anchor left, on the left anchor right, top/bottom centre.
 */
export function labelPlacement(
  n: TopoNode,
  p: { x: number; y: number },
  r: number,
  isCentre: boolean,
): { x: number; y: number; anchor: "start" | "middle" | "end"; baseline: "auto" | "middle" | "hanging" } {
  if (isCentre) {
    return { x: p.x, y: p.y, anchor: "middle", baseline: "middle" };
  }
  const dx = p.x - CX;
  const dy = p.y - CY;
  const len = Math.hypot(dx, dy) || 1;
  const gap = r + 8;
  const x = p.x + (dx / len) * gap;
  const y = p.y + (dy / len) * gap;
  // Horizontal anchor from the x-direction; vertical baseline from the y-direction.
  const anchor = dx > 30 ? "start" : dx < -30 ? "end" : "middle";
  const baseline = dy > 30 ? "hanging" : dy < -30 ? "auto" : "middle";
  return { x, y, anchor, baseline };
}

/** Trim long labels for the SVG; full label stays in the drill panel. */
export function shortLabel(label: string): string {
  if (label.length <= 18) return label;
  return label.slice(0, 16) + "…";
}

/** Map a node level onto the StatusPill status vocabulary. */
export function statusOf(n: TopoNode): "green" | "amber" | "red" | "black" {
  const l = String(n.level);
  if (l === "BLACK" || l === "critical") return "black";
  if (l === "RED" || l === "high") return "red";
  if (l === "AMBER" || l === "med") return "amber";
  return "green";
}
