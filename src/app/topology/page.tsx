// Page — Risk Topology. A radial node-graph of the engine's own wiring:
// indicators → sectors → the national (or one-province) alert. A pure VIEW over
// buildTopology(); it renders the same risk the dashboard shows, as a picture.
import { DashboardFooter } from "@/components/DashboardFooter";
import { PageNav } from "@/components/PageNav";
import { RiskTopology } from "@/components/RiskTopology";
import { StatusBar } from "@/components/StatusBar";
import { WefStrategicIntelligence } from "@/components/WefStrategicIntelligence";
import { EmptyState } from "@/components/ui";
import { FOCUS_PROVINCES, FOCUS_CODES } from "@/lib/focus-provinces";
import {
  getIndicators,
  getLastRun,
  getNationalStatus,
  getRiskThresholds,
  getSectorRisk,
} from "@/lib/data";
import { getWefInsights } from "@/lib/wef";

export const dynamic = "force-dynamic";

export default async function TopologyPage() {
  const [national, indicators, sectorRisks, thresholds, lastRun, wefInsights] =
    await Promise.all([
      getNationalStatus(),
      getIndicators(),
      getSectorRisk(),
      getRiskThresholds(),
      getLastRun(),
      getWefInsights(),
    ]);

  const provinces = FOCUS_PROVINCES.map((p) => ({ code: p.code, name: p.shortLabel }));

  return (
    <main className="min-h-screen bg-surface-0 text-text-1">
      <StatusBar national={national} lastRun={lastRun} />
      <PageNav active="/topology" />

      <header className="px-4 md:px-6 py-6 border-b border-border-subtle">
        <div className="text-[10px] uppercase tracking-[0.12em] text-accent font-semibold mb-1">
          NEWCIS
        </div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
          Risk Topology
        </h1>
        <p className="text-xs text-text-muted mt-2 max-w-3xl leading-relaxed">
          The engine&apos;s own wiring as a picture. The centre is the chosen scope (national
          rollup, or one province); the inner ring is the climate indicators; the outer ring is
          the sectors. Edges trace which indicator drives which sector, and every sector feeds the
          centre. Click any node to see its value, provenance, and the lit edges that explain it —
          the same risk the dashboard shows, no new computation.
        </p>
      </header>

      <div className="px-4 md:px-6 py-6">
        {indicators.length === 0 && sectorRisks.length === 0 ? (
          <EmptyState
            title="No topology to draw"
            description="The data feeds haven't reported yet — refresh from the Operations page to pull the latest readings, then the graph populates."
          />
        ) : (
          <RiskTopology
            indicators={indicators}
            sectorRisks={sectorRisks}
            thresholds={thresholds}
            focusCodes={FOCUS_CODES}
            provinces={provinces}
            wefInsights={wefInsights}
          />
        )}
      </div>

      <div className="px-4 md:px-6 pb-8">
        <WefStrategicIntelligence insights={wefInsights} />
      </div>

      <DashboardFooter lastRun={lastRun} />
    </main>
  );
}
