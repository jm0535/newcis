// Page 3 — Sectoral Impact.
import { PageNav } from "@/components/PageNav";
import { SectorPanel } from "@/components/SectorPanel";
import { StatusBar } from "@/components/StatusBar";
import {
  getIndicators,
  getLastRun,
  getNationalStatus,
  getSectorRisk,
} from "@/lib/data";
import { SECTOR_META } from "@/lib/sectors";
import { fmtDateTime } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function SectorsPage() {
  const [national, indicators, sectorRisk, lastRun] = await Promise.all([
    getNationalStatus(),
    getIndicators(),
    getSectorRisk(),
    getLastRun(),
  ]);

  return (
    <main className="min-h-screen bg-surface-0 text-text-1">
      <StatusBar national={national} lastRun={lastRun} />
      <PageNav active="/sectors" />

      <header className="px-4 md:px-6 py-6 border-b border-border-subtle">
        <div className="text-[10px] uppercase tracking-[0.12em] text-accent font-semibold mb-1">
          Sectoral Impact
        </div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">NEWCIS</h1>
        <p className="text-xs text-text-muted mt-2 max-w-3xl leading-relaxed">
          Seven sectors × four focus provinces, traffic-light coloured. Each cell carries the
          engine's verdict; tooltip shows provenance and data source.
        </p>
      </header>

      <div className="px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {SECTOR_META.map((meta) => (
            <SectorPanel
              key={meta.sector}
              meta={meta}
              sectorRisk={sectorRisk}
              indicators={indicators}
            />
          ))}
        </div>
      </div>

      <footer className="border-t border-border-subtle px-4 md:px-6 py-3 text-[11px] text-text-muted flex flex-wrap justify-between gap-2">
        <span>
          Last ingest{" "}
          <span className="text-text-2" data-numeric>
            {fmtDateTime(lastRun?.finished_at)}
          </span>
        </span>
        <span data-numeric>newcis.in4metrix.dev</span>
      </footer>
    </main>
  );
}
