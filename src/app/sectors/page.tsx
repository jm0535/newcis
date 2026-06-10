// Page 3 — Sectoral Impact.
import { DashboardFooter } from "@/components/DashboardFooter";
import { PageNav } from "@/components/PageNav";
import { SectorPanel } from "@/components/SectorPanel";
import { StatusBar } from "@/components/StatusBar";
import { SectionHeader } from "@/components/ui";
import {
  getIndicators,
  getLastRun,
  getNationalStatus,
  getSectorRisk,
} from "@/lib/data";
import { SECTOR_META } from "@/lib/sectors";
import { FOCUS_COUNT } from "@/lib/focus-provinces";

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
          NEWCIS
        </div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Sectoral Impact</h1>
        <p className="text-xs text-text-muted mt-2 max-w-3xl leading-relaxed">
          How the climate is stressing each part of national life. Scan the bars for red and
          black — that&apos;s where a sector is under real stress.
        </p>
      </header>

      <div className="px-4 md:px-6 py-6">
        <section aria-label="Sector risk panels">
          <SectionHeader
            title="Sector Risk Panels"
            description={`Eight sectors across all ${FOCUS_COUNT} provinces. Each panel shows the national shape — how many provinces sit at each risk level — then names the worst-affected provinces and the signals behind the rating.`}
          />
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
        </section>
      </div>

      <DashboardFooter lastRun={lastRun} />
    </main>
  );
}
