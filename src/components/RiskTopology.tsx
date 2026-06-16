"use client";

/**
 * Risk Topology — a radial node-graph of the engine's own wiring.
 *
 * Centre = the chosen topic (national rollup or one province). Inner ring =
 * climate/hazard indicators, coloured by AlertLevel. Outer ring = sectors,
 * coloured by RiskLevel. Edges trace SECTOR_DRIVERS: which indicator drives which
 * sector, and every sector feeds the centre. Click any node to drill.
 *
 * This is a pure VIEW over buildTopology() — it renders the same risk the
 * dashboard shows, as a picture. No new computation, no external data. Built with
 * hand-laid SVG + framer-motion (no graph library): the layout is deterministic
 * radial maths, so a physics solver would only add weight and fight our tokens.
 */
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Indicator, RiskThreshold, SectorRisk } from "@/lib/types";
import {
  buildTopology,
  CENTER_ID,
  type TopoCenter,
  type TopoNode,
} from "@/lib/topology";
import { ALERT_COLOUR, RISK_COLOUR, INDICATOR_META } from "@/lib/ui";
import { ProvenanceBadge } from "./Provenance";
import { Card, SectionHeader, StatusPill, EmptyState } from "./ui";

const W = 760;
const H = 620;
const CX = W / 2;
const CY = H / 2;
const R_INNER = 150; // indicator ring radius
const R_OUTER = 270; // sector ring radius

type ProvinceOpt = { code: string; name: string };

interface Props {
  indicators: Indicator[];
  sectorRisks: SectorRisk[];
  thresholds: RiskThreshold[];
  focusCodes: string[];
  provinces: ProvinceOpt[];
  /** Optional deep-link: open with a province pre-selected. */
  initialCenter?: TopoCenter;
}

/** Colour for any node: indicators/centre use AlertLevel, sectors use RiskLevel. */
function nodeColour(n: TopoNode): string {
  if (n.kind === "sector") {
    return RISK_COLOUR[n.level as keyof typeof RISK_COLOUR] ?? RISK_COLOUR.low;
  }
  return ALERT_COLOUR[n.level as keyof typeof ALERT_COLOUR] ?? ALERT_COLOUR.GREEN;
}

/** Place ring nodes evenly around the circle, first node at the top (−90°). */
function ringPosition(i: number, count: number, radius: number) {
  const angle = (i / Math.max(count, 1)) * 2 * Math.PI - Math.PI / 2;
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
}

export function RiskTopology({
  indicators,
  sectorRisks,
  thresholds,
  focusCodes,
  provinces,
  initialCenter,
}: Props) {
  const reduce = useReducedMotion();
  const [center, setCenter] = useState<TopoCenter>(initialCenter ?? { kind: "national" });
  const [selected, setSelected] = useState<string | null>(null);

  const topo = useMemo(
    () => buildTopology({ indicators, sectorRisks, thresholds, focusCodes, center }),
    [indicators, sectorRisks, thresholds, focusCodes, center],
  );

  // Pre-compute positions keyed by node id so edges and nodes agree.
  const pos = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    m.set(CENTER_ID, { x: CX, y: CY });
    const inds = topo.nodes.filter((n) => n.kind === "indicator");
    const secs = topo.nodes.filter((n) => n.kind === "sector");
    inds.forEach((n, i) => m.set(n.id, ringPosition(i, inds.length, R_INNER)));
    secs.forEach((n, i) => m.set(n.id, ringPosition(i, secs.length, R_OUTER)));
    return m;
  }, [topo]);

  const byId = useMemo(
    () => new Map(topo.nodes.map((n) => [n.id, n])),
    [topo],
  );
  const selectedNode = selected ? byId.get(selected) : undefined;

  if (topo.nodes.length <= 1) {
    return (
      <EmptyState
        title="No topology to draw"
        description="No indicators or sector risk available this cycle."
      />
    );
  }

  const t = (i: number) => (reduce ? 0 : i * 0.025);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {/* ---- graph ---- */}
      <Card className="relative overflow-hidden p-0">
        {/* centre scope — segmented National/Province toggle + a province picker.
            23 flat chips don't scale; enterprise pattern is a primary segmented
            control with a combobox for the long province list. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 border-b border-border-subtle">
          <span
            id="topo-scope-label"
            className="text-[10px] uppercase tracking-[0.1em] text-text-muted font-semibold"
          >
            Scope
          </span>

          {/* segmented National / Province */}
          <div
            role="group"
            aria-labelledby="topo-scope-label"
            className="inline-flex rounded-md border border-border-default overflow-hidden"
          >
            <button
              type="button"
              aria-pressed={center.kind === "national"}
              onClick={() => {
                setCenter({ kind: "national" });
                setSelected(null);
              }}
              className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
                center.kind === "national"
                  ? "bg-accent text-accent-foreground"
                  : "text-text-muted hover:text-text-1 hover:bg-surface-2"
              }`}
            >
              National
            </button>
            <button
              type="button"
              aria-pressed={center.kind === "province"}
              onClick={() => {
                // entering Province mode defaults to the first province
                const first = provinces[0];
                if (first) {
                  setCenter({ kind: "province", code: first.code, name: first.name });
                  setSelected(null);
                }
              }}
              className={`px-3 py-1.5 text-[11px] font-medium border-l border-border-default transition-colors ${
                center.kind === "province"
                  ? "bg-accent text-accent-foreground"
                  : "text-text-muted hover:text-text-1 hover:bg-surface-2"
              }`}
            >
              Province
            </button>
          </div>

          {/* province picker — enabled only in Province mode */}
          <label className="inline-flex items-center gap-2 text-[11px] text-text-muted">
            <span className="sr-only">Select province</span>
            <select
              value={center.kind === "province" ? center.code : ""}
              disabled={center.kind !== "province"}
              onChange={(e) => {
                const p = provinces.find((x) => x.code === e.target.value);
                if (p) {
                  setCenter({ kind: "province", code: p.code, name: p.name });
                  setSelected(null);
                }
              }}
              className="px-2.5 py-1.5 rounded-md border border-border-default bg-surface-1 text-text-1 text-[11px] font-medium transition-colors hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {center.kind !== "province" && <option value="">— choose province —</option>}
              {provinces.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* ring + edge legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 pt-3 text-[11px] text-text-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border border-border-strong bg-surface-3" />
            Inner ring · <span className="font-semibold">indicators</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border border-border-strong bg-surface-2" />
            Outer ring · <span className="font-semibold">sectors</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-text-1" />
            driver edge
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-dashed border-text-1" />
            province-attributed (e.g. SEISMIC)
          </span>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label="Risk topology graph: indicators driving sectors driving the national alert"
        >
          {/* ring guides — solid filled bands so the tiers read in BOTH themes.
              Tokens flip per theme (surface-2/3, border-strong) so the contrast
              holds in light and dark alike. */}
          {/* outer band (sectors) */}
          <circle cx={CX} cy={CY} r={R_OUTER + 22} className="fill-surface-2 stroke-border-strong" strokeWidth={1.5} />
          {/* inner band (indicators) — nested, a shade deeper */}
          <circle cx={CX} cy={CY} r={R_INNER + 22} className="fill-surface-3 stroke-border-strong" strokeWidth={1.5} />
          {/* the two node circles, dashed, sitting on each tier */}
          <circle cx={CX} cy={CY} r={R_INNER} className="fill-none stroke-border-strong" strokeDasharray="4 5" strokeWidth={1.5} />
          <circle cx={CX} cy={CY} r={R_OUTER} className="fill-none stroke-border-strong" strokeDasharray="4 5" strokeWidth={1.5} />

          {/* edges */}
          {topo.edges.map((e, i) => {
            const a = pos.get(e.from);
            const b = pos.get(e.to);
            if (!a || !b) return null;
            const colour =
              byId.get(e.from)?.kind === "sector"
                ? RISK_COLOUR[(byId.get(e.from)!.level as keyof typeof RISK_COLOUR)] ?? RISK_COLOUR.low
                : ALERT_COLOUR[(e.level as keyof typeof ALERT_COLOUR)] ?? ALERT_COLOUR.GREEN;
            const related = !selected || e.from === selected || e.to === selected;
            // Vibrant in BOTH themes: lit edges ride high opacity so the saturated
            // hex colours read on white as well as dark. Unrelated edges dim but
            // stay faintly visible (not invisible) for context.
            const dim = related ? (selected ? 0.95 : 0.75) : 0.12;
            // gentle quadratic curve, bowed toward centre
            const mx = (a.x + b.x) / 2 + (CX - (a.x + b.x) / 2) * 0.18;
            const my = (a.y + b.y) / 2 + (CY - (a.y + b.y) / 2) * 0.18;
            // Attributed edges (e.g. SEISMIC → Disaster & Hazard) are dashed: the
            // link is real but reaches the sector by per-province attribution, not
            // the national driver map.
            const attributed = e.kind === "attributed";
            return (
              <motion.path
                key={`${e.from}->${e.to}-${i}`}
                d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
                fill="none"
                stroke={colour}
                strokeWidth={related && selected ? 2.5 : attributed ? 1.75 : 1.5}
                strokeDasharray={attributed ? "5 4" : undefined}
                initial={{ opacity: 0 }}
                animate={{ opacity: dim }}
                transition={{ duration: reduce ? 0 : 0.4, delay: t(i) }}
              />
            );
          })}

          {/* nodes */}
          {topo.nodes.map((n, i) => {
            const p = pos.get(n.id)!;
            const colour = nodeColour(n);
            const isCentre = n.kind === "center";
            const r = isCentre ? 30 : n.kind === "sector" ? 16 : 13;
            const isSel = selected === n.id;
            const hot = n.level === "RED" || n.level === "BLACK" || n.level === "high" || n.level === "critical";
            // Lay the label radially OUTWARD from centre so text never overlaps the
            // hub. Anchor + baseline follow the quadrant so labels read cleanly.
            const label = labelPlacement(n, p, r, isCentre);
            return (
              <motion.g
                key={n.id}
                style={{ cursor: "pointer" }}
                onClick={() => setSelected(isSel ? null : n.id)}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: reduce ? 0 : 0.35, delay: t(i) }}
              >
                {/* pulse halo on hot nodes */}
                {hot && !reduce && (
                  <motion.circle
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    fill={colour}
                    initial={{ opacity: 0.4, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.9 }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                  />
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={colour}
                  fillOpacity={isCentre ? 0.25 : 0.9}
                  stroke={colour}
                  strokeWidth={isSel ? 3 : 1.5}
                />
                <text
                  x={label.x}
                  y={label.y}
                  textAnchor={label.anchor}
                  dominantBaseline={label.baseline}
                  className={`pointer-events-none ${
                    isCentre || isSel ? "fill-text-1 font-semibold" : "fill-text-muted"
                  }`}
                  style={{ fontSize: isCentre ? 11 : 10 }}
                >
                  {shortLabel(n.label)}
                </text>
              </motion.g>
            );
          })}
        </svg>
      </Card>

      {/* ---- drill panel ---- */}
      <div className="space-y-3">
        <SectionHeader
          title="Inspect"
          description="Click a node to trace why a sector sits where it does."
        />
        {selectedNode ? (
          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ background: nodeColour(selectedNode) }}
                />
                <h3 className="text-sm font-semibold">{selectedNode.label}</h3>
              </div>
              <ProvenanceBadge value={selectedNode.provenance} />
            </div>

            <div className="flex items-center gap-2">
              <StatusPill status={statusOf(selectedNode)}>
                {String(selectedNode.level).toUpperCase()}
              </StatusPill>
              <span className="text-[11px] uppercase tracking-[0.08em] text-text-muted">
                {selectedNode.kind}
              </span>
            </div>

            {selectedNode.kind === "indicator" && (
              <div className="text-xs text-text-muted leading-relaxed space-y-1.5">
                {selectedNode.value != null && (
                  <div data-numeric className="text-text-1">
                    {selectedNode.value}
                    {selectedNode.unit ? ` ${selectedNode.unit}` : ""}
                  </div>
                )}
                {INDICATOR_META[selectedNode.id]?.plain && (
                  <p>{INDICATOR_META[selectedNode.id].plain}</p>
                )}
                {selectedNode.note && <p className="text-text-muted">Source: {selectedNode.note}</p>}
              </div>
            )}

            {selectedNode.kind === "sector" && (
              <p className="text-xs text-text-muted leading-relaxed">
                Worst risk across the centre&apos;s scope. Trace the lit edges back to
                the indicators driving it — that is the &quot;why&quot;.
              </p>
            )}

            {selectedNode.kind === "center" && (
              <p className="text-xs text-text-muted leading-relaxed">
                The alert level is the worst live indicator on the inner ring.
                Sectors fan out to it; indicators feed the sectors.
              </p>
            )}
          </Card>
        ) : (
          <EmptyState
            title="Nothing selected"
            description="Pick a node on the graph to inspect its value, provenance, and drivers."
          />
        )}
      </div>
    </div>
  );
}

/**
 * Place a node's label radially OUTWARD from the centre, so text fans away from
 * the hub instead of piling on top of it. The anchor/baseline follow the angle:
 * labels on the right anchor left, on the left anchor right, top/bottom centre.
 */
function labelPlacement(
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
function shortLabel(label: string): string {
  if (label.length <= 18) return label;
  return label.slice(0, 16) + "…";
}

/** Map a node level onto the StatusPill status vocabulary. */
function statusOf(n: TopoNode): "green" | "amber" | "red" | "black" {
  const l = String(n.level);
  if (l === "BLACK" || l === "critical") return "black";
  if (l === "RED" || l === "high") return "red";
  if (l === "AMBER" || l === "med") return "amber";
  return "green";
}
