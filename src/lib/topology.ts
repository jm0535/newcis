/**
 * Risk Topology builder — a PURE projection of the risk engine's own graph into
 * {nodes, edges} for the radial "Risk Topology" view.
 *
 * It invents NO new risk. Indicator levels come from classifyIndicator; sector
 * levels are the worst observed level across the scoped provinces; the edges are
 * SECTOR_DRIVERS (the same indicator→sector wiring scoreSector uses). So the graph
 * can never disagree with the dashboard — it re-expresses the same engine output
 * as a picture. Same purity contract as the engine: missing data degrades to a
 * GREEN / low floor, it never throws.
 *
 * Three rings, laid out radially by the view layer:
 *   ring 0 — the centre topic (national rollup, or one province)
 *   ring 1 — climate/hazard indicators (coloured by AlertLevel)
 *   ring 2 — sectors (coloured by RiskLevel)
 * Edges: driver indicator → sector (from SECTOR_DRIVERS), and sector → centre.
 */
import { classifyIndicator, SECTOR_DRIVERS } from "./risk-engine";
import type {
  AlertLevel,
  Indicator,
  Provenance,
  RiskLevel,
  RiskThreshold,
  Sector,
  SectorRisk,
} from "./types";

/** Stable id for the single centre node (sectors link to this). */
export const CENTER_ID = "__center__";

export type TopoKind = "center" | "indicator" | "sector";

export interface TopoNode {
  id: string;
  kind: TopoKind;
  label: string;
  /** AlertLevel for indicators/centre, RiskLevel for sectors. Drives node colour. */
  level: AlertLevel | RiskLevel;
  ring: 0 | 1 | 2;
  provenance: Provenance;
  /** Raw reading (indicators only) for the drill panel. */
  value?: number | null;
  unit?: string;
  /** Plain-language source / driver note for the drill panel. */
  note?: string;
}

export interface TopoEdge {
  from: string;
  to: string;
  /** Severity of the downstream node, so the view can weight edge opacity. */
  level: AlertLevel | RiskLevel;
  /**
   * How the edge is wired:
   *  - "driver"     — national indicator → sector (from SECTOR_DRIVERS)
   *  - "rollup"     — sector → centre
   *  - "attributed" — indicator that drives a sector by PER-PROVINCE spatial
   *                   attribution, not the national SECTOR_DRIVERS map (e.g.
   *                   SEISMIC epicentres → Disaster & Hazard). Drawn dashed so
   *                   the view can show the link without implying a national driver.
   */
  kind: "driver" | "rollup" | "attributed";
}

/**
 * Indicators that drive a sector by PER-PROVINCE spatial attribution rather than
 * the national SECTOR_DRIVERS map. The engine deliberately omits these from
 * SECTOR_DRIVERS (a national count would apply uniformly to every province — the
 * replication the spatial join exists to avoid); they max-merge in via the
 * per-province sector rows instead. The topology still SHOWS the link, dashed.
 */
const ATTRIBUTED_DRIVERS: Record<string, Sector> = {
  SEISMIC: "Disaster & Hazard",
};

export interface Topology {
  nodes: TopoNode[];
  edges: TopoEdge[];
  center: TopoCenter;
}

export type TopoCenter =
  | { kind: "national" }
  | { kind: "province"; code: string; name?: string };

export interface BuildTopologyInput {
  indicators: Indicator[];
  sectorRisks: SectorRisk[];
  thresholds: RiskThreshold[];
  focusCodes: string[];
  center: TopoCenter;
}

const RISK_ORDER: RiskLevel[] = ["low", "med", "high", "critical"];
const ALERT_ORDER: AlertLevel[] = ["GREEN", "AMBER", "RED", "BLACK"];

function worstRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_ORDER.indexOf(a) >= RISK_ORDER.indexOf(b) ? a : b;
}

/**
 * Forward-looking indicators that must NOT raise today's alert. Mirrors
 * rollUpNational's NON_ALERT_KEYS: PROJECTED_ONI is the NMME forecast — it drives
 * the /forecast outlook, never the live national alert. Keeping these out of the
 * centre rollup is what makes the topology centre AGREE with national_status.json
 * (otherwise a forecast leaning El Niño would falsely push the centre to BLACK).
 */
const NON_ALERT_KEYS = new Set(["PROJECTED_ONI"]);

/**
 * Roll a national centre's AlertLevel from the worst LIVE indicator on screen.
 * Forecast-only indicators (NON_ALERT_KEYS) are excluded so this matches the
 * engine's rollUpNational — the centre level can never disagree with the alert
 * the rest of the dashboard shows. The excluded indicators still render as their
 * own nodes; they just don't escalate the centre.
 */
function worstAlertFromIndicators(
  indicators: Indicator[],
  thresholdByKey: Map<string, RiskThreshold>,
): AlertLevel {
  let worst: AlertLevel = "GREEN";
  for (const ind of indicators) {
    if (NON_ALERT_KEYS.has(ind.key)) continue;
    const lvl = classifyIndicator(ind.value, thresholdByKey.get(ind.key));
    if (ALERT_ORDER.indexOf(lvl) > ALERT_ORDER.indexOf(worst)) worst = lvl;
  }
  return worst;
}

const ALL_SECTORS = Object.keys(SECTOR_DRIVERS) as Sector[];

export function buildTopology(input: BuildTopologyInput): Topology {
  const { indicators, sectorRisks, thresholds, focusCodes, center } = input;
  const thresholdByKey = new Map(thresholds.map((t) => [t.metric, t]));

  const nodes: TopoNode[] = [];
  const edges: TopoEdge[] = [];

  // ----- ring 0: centre -----
  const inScope =
    center.kind === "province"
      ? new Set([center.code])
      : new Set(focusCodes);
  const scopedRows = sectorRisks.filter((r) => inScope.has(r.province_code));

  const centerLevel: AlertLevel = worstAlertFromIndicators(indicators, thresholdByKey);
  const centerLabel =
    center.kind === "province"
      ? center.name
        ? `${center.name} (${center.code})`
        : `Province ${center.code}`
      : "National rollup";
  nodes.push({
    id: CENTER_ID,
    kind: "center",
    label: centerLabel,
    level: centerLevel,
    ring: 0,
    provenance: "LIVE",
  });

  // ----- ring 1: indicators -----
  for (const ind of indicators) {
    nodes.push({
      id: ind.key,
      kind: "indicator",
      label: ind.label || ind.key,
      level: classifyIndicator(ind.value, thresholdByKey.get(ind.key)),
      ring: 1,
      provenance: ind.provenance,
      value: ind.value,
      unit: ind.unit,
      note: ind.source,
    });
  }
  const haveIndicator = new Set(indicators.map((i) => i.key));

  // ----- ring 2: sectors -----
  // Worst observed level per sector across the scoped provinces. A sector with no
  // row in scope still appears (low floor) so the topology shape stays stable.
  const worstBySector = new Map<Sector, RiskLevel>();
  const provBySector = new Map<Sector, Provenance>();
  for (const row of scopedRows) {
    const prev = worstBySector.get(row.sector) ?? "low";
    const next = worstRisk(prev, row.level);
    worstBySector.set(row.sector, next);
    // Track provenance of the worst-contributing row.
    if (next === row.level) provBySector.set(row.sector, row.provenance);
  }

  for (const sector of ALL_SECTORS) {
    const level = worstBySector.get(sector) ?? "low";
    nodes.push({
      id: sector,
      kind: "sector",
      label: sector,
      level,
      ring: 2,
      provenance: provBySector.get(sector) ?? "DEMO",
    });

    // sector → centre
    edges.push({ from: sector, to: CENTER_ID, level, kind: "rollup" });

    // driver indicator → sector (only for indicators actually on screen)
    for (const driverKey of SECTOR_DRIVERS[sector]) {
      if (!haveIndicator.has(driverKey)) continue;
      const drv = nodes.find((n) => n.id === driverKey && n.kind === "indicator");
      edges.push({
        from: driverKey,
        to: sector,
        level: drv ? (drv.level as AlertLevel) : "GREEN",
        kind: "driver",
      });
    }
  }

  // Province-attributed drivers (e.g. SEISMIC → Disaster & Hazard). These are NOT
  // in SECTOR_DRIVERS — they reach the sector by per-province spatial attribution
  // — but the graph still shows the link, dashed, so the node is not an orphan.
  for (const [driverKey, sector] of Object.entries(ATTRIBUTED_DRIVERS)) {
    if (!haveIndicator.has(driverKey)) continue;
    const drv = nodes.find((n) => n.id === driverKey && n.kind === "indicator");
    edges.push({
      from: driverKey,
      to: sector,
      level: drv ? (drv.level as AlertLevel) : "GREEN",
      kind: "attributed",
    });
  }

  return { nodes, edges, center };
}
