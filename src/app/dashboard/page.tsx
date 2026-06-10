// Page 1 — Executive Strategic Overview (the operating picture).
// Lives at /dashboard; the landing page at / links here via "Enter Operating Picture".
import { AUTO_REFRESH_LABEL } from "@/components/AutoRefresh";
import { ExecutiveHeadline } from "@/components/ExecutiveHeadline";
import { HeatMap } from "@/components/HeatMap";
import { KpiStrip } from "@/components/KpiStrip";
import { PageNav } from "@/components/PageNav";
import { ProvenanceBadge } from "@/components/Provenance";
import { RiskMatrix } from "@/components/RiskMatrix";
import { StatusBar } from "@/components/StatusBar";
import { Card, SectionHeader, Badge } from "@/components/ui";
import { getLastRun, getNationalStatus, getSectorRisk } from "@/lib/data";
import { FOCUS_COUNT } from "@/lib/focus-provinces";
import { fmtDateTime } from "@/lib/ui";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [national, sectorRisk, lastRun] = await Promise.all([
    getNationalStatus(),
    getSectorRisk(),
    getLastRun(),
  ]);

  const liveSourceCount = lastRun
    ? Object.values(lastRun.sources_ok).filter(Boolean).length
    : 0;
  const totalSources = lastRun ? Object.keys(lastRun.sources_ok).length : 0;

  return (
    <main className="min-h-screen bg-surface-0 text-text-1">
      <StatusBar national={national} lastRun={lastRun} />
      <PageNav active="/dashboard" />

      <header className="px-4 md:px-6 py-6 border-b border-border-subtle flex flex-wrap items-end gap-x-6 gap-y-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.12em] text-accent font-semibold mb-1">
            NEWCIS · Papua New Guinea
          </div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-text-1">
            Executive Strategic Overview
          </h1>
        </div>
        <span className="text-xs text-text-muted">
          <span data-numeric>
            {liveSourceCount}/{totalSources}
          </span>{" "}
          sources LIVE this cycle
        </span>
        <Badge variant="accent" className="ml-auto">
          <Sparkles size={10} /> Prototype
        </Badge>
      </header>

      <div className="px-4 md:px-6 py-6 space-y-6">
        <section aria-label="Bottom-line summary">
          <ExecutiveHeadline national={national} />
        </section>

        <section aria-label="National key performance indicators">
          <KpiStrip national={national} />
        </section>

        {/* Matrix gets its own full-width row — at the full province set an 8×22
            colour heatmap needs the width, and it is the primary executive artifact. */}
        <section aria-label="National risk matrix">
          <Card padding="lg">
            <SectionHeader
              title="National Risk Matrix"
              description="Every sector × province, coloured by risk — provinces sorted worst-first so trouble sits at the left. The 'National' column is each sector's worst level and how many provinces sit there. Click a cell for the detail behind it."
            />
            <RiskMatrix sectorRisk={sectorRisk} />
            <div className="mt-4 pt-3 border-t border-border-subtle text-[11px] text-text-muted flex flex-wrap items-center gap-2">
              {Array.from(new Set(sectorRisk.map((r) => r.provenance))).map((p) => (
                <ProvenanceBadge key={p} value={p} />
              ))}
              <span>cells carry worst risk across drivers; trend from prior ingest.</span>
            </div>
          </Card>
        </section>

        <section aria-label="Provincial heat map">
          <Card padding="lg">
            <SectionHeader
              title="Provincial Heat Map"
              description={`The ${FOCUS_COUNT} focus provinces coloured by their worst sector risk. Click a province for detail · swap basemaps top-right.`}
            />
            <HeatMap sectorRisk={sectorRisk} />
          </Card>
        </section>
      </div>

      <footer className="border-t border-border-subtle px-4 md:px-6 py-3 text-[11px] text-text-muted flex flex-wrap justify-between gap-2">
        <span>
          Last ingest{" "}
          <span className="text-text-2" data-numeric>
            {fmtDateTime(lastRun?.finished_at)}
          </span>
          {lastRun && <span className="ml-2 text-text-disabled">· {lastRun.notes}</span>}
        </span>
        <span>Auto-refreshes {AUTO_REFRESH_LABEL}</span>
        <span>
          Powered by{" "}
          <a
            href="https://www.in4metrix.dev"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            in4metrix
          </a>
        </span>
      </footer>
    </main>
  );
}
