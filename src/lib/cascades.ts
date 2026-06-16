/**
 * SECTOR_CASCADES — curated sector→sector causal links (the WEF "neural map"
 * payoff). These are TRUE real-world dependencies (e.g. water scarcity raises
 * disease risk), drawn so the topology shows how risks drive EACH OTHER — not
 * just indicator→sector. They are a VIEW-ONLY overlay badged REFERENCE: they
 * show the relationship, they do NOT re-score any sector. `strength` is reserved
 * for a future engine-wired amplifier (see the design doc, §7) and is unused by
 * the current view.
 */
import type { Sector } from "./types";

export interface SectorCascade {
  from: Sector;
  to: Sector;
  rationale: string;
  strength: "weak" | "moderate" | "strong";
}

export const SECTOR_CASCADES: SectorCascade[] = [
  {
    from: "Water Security",
    to: "Public Health",
    strength: "strong",
    rationale: "Water scarcity and contamination raise waterborne-disease risk.",
  },
  {
    from: "Food Security",
    to: "Social Stability",
    strength: "strong",
    rationale: "Food shortages and price spikes drive unrest and displacement.",
  },
  {
    from: "Disaster & Hazard",
    to: "Infrastructure",
    strength: "moderate",
    rationale: "Seismic and flood events damage roads, power, and water systems.",
  },
  {
    from: "Economic Stability",
    to: "Food Security",
    strength: "moderate",
    rationale: "Economic shock erodes import capacity and household purchasing power.",
  },
  {
    from: "Infrastructure",
    to: "Energy Security",
    strength: "moderate",
    rationale: "Damaged transport and grid disrupt fuel and power delivery.",
  },
  {
    from: "Public Health",
    to: "Social Stability",
    strength: "weak",
    rationale: "Health-system strain compounds social pressure.",
  },
];
