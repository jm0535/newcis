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
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Minus, Plus, Maximize } from "lucide-react";
import type { Indicator, RiskThreshold, SectorRisk } from "@/lib/types";
import {
  buildTopology,
  CENTER_ID,
  type TopoCenter,
} from "@/lib/topology";
import type { WefInsight } from "@/lib/wef";
import { WefCover } from "./WefCover";
import { INDICATOR_META } from "@/lib/ui";
import { ProvenanceBadge } from "./Provenance";
import { Card, SectionHeader, StatusPill, EmptyState } from "./ui";
import {
  CX,
  CY,
  R_INNER,
  R_OUTER,
  W,
  H,
  edgeSeverity,
  edgeColour,
  SPARK_PROFILE,
  nodeColour,
  ringPosition,
  labelPlacement,
  shortLabel,
  statusOf,
} from "./RiskTopology.helpers";

type ProvinceOpt = { code: string; name: string };

interface Props {
  indicators: Indicator[];
  sectorRisks: SectorRisk[];
  thresholds: RiskThreshold[];
  focusCodes: string[];
  provinces: ProvinceOpt[];
  /** WEF insights for the per-sector drill context (placement C). */
  wefInsights?: WefInsight[];
  /** Optional deep-link: open with a province pre-selected. */
  initialCenter?: TopoCenter;
}

export function RiskTopology({
  indicators,
  sectorRisks,
  thresholds,
  focusCodes,
  provinces,
  wefInsights = [],
  initialCenter,
}: Props) {
  const reduce = useReducedMotion();
  const [center, setCenter] = useState<TopoCenter>(initialCenter ?? { kind: "national" });
  const [selected, setSelected] = useState<string | null>(null);

  // ---- in-card zoom + pan ----------------------------------------------------
  // The graph is laid out in a fixed W×H user-space; we view it through a
  // viewBox-sized window and transform a single <g> by (translate, scale). Zoom
  // is wheel-driven, clamped, and anchored on the cursor so the point under the
  // pointer stays put. Pan is pointer-drag. Crucially the wheel handler calls
  // preventDefault so scrolling INSIDE the card zooms the graph, not the page —
  // React's onWheel is passive, so we bind a non-passive native listener.
  const ZOOM_MIN = 0.6;
  const ZOOM_MAX = 4;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

  // Map a client point to the SVG's user-space (accounts for the viewBox fit).
  const toUser = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: CX, y: CY };
    const r = svg.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * W,
      y: ((clientY - r.top) / r.height) * H,
    };
  };

  // Zoom toward an anchor in user-space, keeping that anchor fixed on screen.
  const zoomTo = (nextRaw: number, anchor: { x: number; y: number }) => {
    setZoom((z) => {
      const next = clampZoom(nextRaw);
      const k = next / z;
      setPan((p) => ({
        x: anchor.x - (anchor.x - p.x) * k,
        y: anchor.y - (anchor.y - p.y) * k,
      }));
      return next;
    });
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // keep the gesture in the card, not the page
      const anchor = toUser(e.clientX, e.clientY);
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomTo(clampZoom(zoom * factor), anchor);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

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
  const wefBySector = useMemo(() => {
    const m = new Map<string, WefInsight>();
    for (const w of wefInsights) {
      if (w.sector && !m.has(w.sector)) m.set(w.sector, w);
    }
    return m;
  }, [wefInsights]);
  const selectedWef =
    selectedNode?.kind === "sector" ? wefBySector.get(selectedNode.id) : undefined;

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
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-dotted border-text-1" />
            risk cascade <span className="font-semibold">(REFERENCE)</span>
          </span>
        </div>

        <div className="relative">
          {/* in-card zoom controls — float over the graph, top-right */}
          <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => zoomTo(zoom * 1.25, { x: CX, y: CY })}
              className="grid h-7 w-7 place-items-center rounded-md border border-border-default bg-surface-1/90 text-text-1 backdrop-blur transition-colors hover:border-border-strong hover:bg-surface-2"
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => zoomTo(zoom / 1.25, { x: CX, y: CY })}
              className="grid h-7 w-7 place-items-center rounded-md border border-border-default bg-surface-1/90 text-text-1 backdrop-blur transition-colors hover:border-border-strong hover:bg-surface-2"
            >
              <Minus size={14} />
            </button>
            <button
              type="button"
              aria-label="Reset view"
              onClick={resetView}
              className="grid h-7 w-7 place-items-center rounded-md border border-border-default bg-surface-1/90 text-text-muted backdrop-blur transition-colors hover:border-border-strong hover:bg-surface-2 hover:text-text-1"
            >
              <Maximize size={13} />
            </button>
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full max-h-[68vh] touch-none select-none"
            style={{ cursor: drag.current ? "grabbing" : "grab" }}
            role="img"
            aria-label="Risk topology graph: indicators driving sectors driving the national alert. Scroll to zoom, drag to pan."
            onPointerDown={(e) => {
              // ignore drags that start on a node (those select); pan on background
              if ((e.target as Element).closest("[data-node]")) return;
              (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              const svg = svgRef.current!;
              const r = svg.getBoundingClientRect();
              const sx = W / r.width;
              const sy = H / r.height;
              setPan({
                x: d.px + (e.clientX - d.x) * sx,
                y: d.py + (e.clientY - d.y) * sy,
              });
            }}
            onPointerUp={(e) => {
              drag.current = null;
              (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
            }}
            onPointerLeave={() => {
              drag.current = null;
            }}
          >
            <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
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
            const fromNode = byId.get(e.from);
            const fromIsSector = fromNode?.kind === "sector";
            const colour = edgeColour(
              fromIsSector,
              String(fromNode?.level),
              String(e.level),
            );
            const related = !selected || e.from === selected || e.to === selected;
            // Vibrant in BOTH themes: lit edges ride high opacity so the saturated
            // hex colours read on white as well as dark. Unrelated edges dim but
            // stay faintly visible (not invisible) for context.
            const dim = related ? (selected ? 0.95 : 0.75) : 0.12;
            // Attributed edges (e.g. SEISMIC → Disaster & Hazard) are dashed: the
            // link is real but reaches the sector by per-province attribution, not
            // the national driver map.
            const attributed = e.kind === "attributed";
            const cascade = e.kind === "cascade";
            // Cascade edges (sector→sector) bow harder and ride a distinct dotted
            // stroke so the "risks drive each other" web reads separately from the
            // radial driver/rollup spokes. They are REFERENCE, never a rescore.
            const bow = cascade ? 0.42 : 0.18;
            const mx = (a.x + b.x) / 2 + (CX - (a.x + b.x) / 2) * bow;
            const my = (a.y + b.y) / 2 + (CY - (a.y + b.y) / 2) * bow;
            const d = `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
            // The edge's own severity: sector-source edges (rollup, cascade) carry
            // the source sector's risk level; spokes carry e.level (the indicator's
            // alert). This is the SAME value `colour` is derived from above, so the
            // spark's tempo matches the edge's colour.
            const edgeLevel = fromIsSector
              ? String(fromNode!.level)
              : String(e.level);
            const severity = edgeSeverity(edgeLevel);
            // An edge fires when it carries real signal (amber/med and above) AND
            // is in view (nothing selected, or it's related to the selection).
            // Green/low stays dark — all-clear pathways carry no pulse, so the
            // firing map reads as exactly where concern is building. Every edge is
            // stored cause-first (from → to), so the spark travels the cause path.
            const fires = !reduce && related && severity > 0;
            const profile = severity > 0 ? SPARK_PROFILE[severity as 1 | 2 | 3] : null;
            // Cascades pulse a touch slower than the radial spokes at the same
            // severity, so the sector↔sector web reads as a secondary rhythm.
            const sparkDur = profile ? profile.dur * (cascade ? 1.4 : 1) : 0;
            return (
              <g key={`${e.from}->${e.to}-${i}`}>
                <motion.path
                  d={d}
                  fill="none"
                  stroke={colour}
                  strokeWidth={related && selected ? 2.5 : cascade ? 2 : attributed ? 1.75 : 1.5}
                  strokeDasharray={cascade ? "2 5" : attributed ? "5 4" : undefined}
                  strokeLinecap={cascade ? "round" : undefined}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: dim }}
                  transition={{ duration: reduce ? 0 : 0.4, delay: t(i) }}
                />
                {fires && profile && (
                  // The neuron spark: a short bright segment that travels the path
                  // by sweeping stroke-dashoffset, looping. pathLength={1}
                  // normalises every edge to a 0–1 length so one dash config fits
                  // all. Width + glow scale with severity (see SPARK_PROFILE);
                  // staggered start (delay) so pathways fire out of sync.
                  <motion.path
                    d={d}
                    fill="none"
                    stroke={colour}
                    strokeWidth={profile.width}
                    strokeLinecap="round"
                    pathLength={1}
                    // One short lead dash (0.12) then a gap LONGER than the whole
                    // path (1.5), so only ever ONE spark is on the edge — no second
                    // dash wrapping in from the far end to read as reverse motion.
                    // Sweeping the offset from +period down to 0 carries that single
                    // dash strictly from → to, the cause direction.
                    strokeDasharray="0.12 1.5"
                    style={{ filter: `drop-shadow(0 0 ${profile.glow}px ${colour})` }}
                    initial={{ strokeDashoffset: 1.62, opacity: 0 }}
                    animate={{ strokeDashoffset: [1.62, 0], opacity: [0, 1, 1, 0] }}
                    transition={{
                      duration: sparkDur,
                      repeat: Infinity,
                      ease: "linear",
                      delay: (i % 7) * 0.28,
                      times: [0, 0.08, 0.62, 0.74],
                    }}
                  />
                )}
              </g>
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
                data-node
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
            </g>
          </svg>
        </div>
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
              <>
                <p className="text-xs text-text-muted leading-relaxed">
                  Worst risk across the centre&apos;s scope. Trace the lit edges back to
                  the indicators driving it, and the dotted cascades to the sectors it
                  pressures — that is the &quot;why&quot;.
                </p>
                {selectedWef && (
                  <a
                    href={selectedWef.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-md border border-border-default p-2.5 hover:border-border-strong transition-colors group"
                  >
                    <div className="text-[10px] uppercase tracking-[0.1em] text-text-muted mb-1">
                      WEF context
                    </div>
                    <div className="text-xs font-medium group-hover:text-accent transition-colors">
                      {selectedWef.title}
                    </div>
                    <WefCover insight={selectedWef} className="mt-2 h-24" />
                  </a>
                )}
              </>
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
