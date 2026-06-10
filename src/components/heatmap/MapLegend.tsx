// Heat-map legend overlay. Split out of HeatMap.tsx (500-line budget): purely
// presentational — the risk-colour swatches, the non-focus swatch, the hazard-kind
// glyphs, and the REFERENCE-provenance note. No state; reads only the shared
// palette + hazard styles.
import type { RiskLevel } from "@/lib/types";
import { RISK_COLOUR } from "@/lib/ui";
import { HAZARD_KINDS, HAZARD_STYLE } from "./hazards";

export function MapLegend() {
  return (
    <div className="absolute bottom-3 left-3 bg-[var(--surface-overlay)] backdrop-blur border border-border-subtle rounded-md px-2.5 py-1.5 text-[10px] uppercase tracking-[0.08em] text-text-muted flex items-center gap-3 shadow-[var(--elevation-2)]">
      {(["low", "med", "high", "critical"] as RiskLevel[]).map((lv) => (
        <span key={lv} className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm" style={{ background: RISK_COLOUR[lv] }} />
          {lv}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5 text-text-disabled">
        <span className="w-2 h-2 rounded-sm bg-border-default" />
        non-focus
      </span>
      {HAZARD_KINDS.map((kind) => (
        <span key={kind} className="inline-flex items-center gap-1.5 text-text-disabled normal-case">
          <span aria-hidden>{HAZARD_STYLE[kind].glyph}</span>
          {HAZARD_STYLE[kind].label}
        </span>
      ))}
      <span
        className="inline-flex items-center gap-1.5 text-text-disabled normal-case"
        title="A curated record of notable PNG hazard events, not a complete history. Provinces without a marker are a data gap — not necessarily disaster-free."
      >
        curated sample · REFERENCE
      </span>
    </div>
  );
}
