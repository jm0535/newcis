// Page 3 — Sectoral Impact.
import { AUTO_REFRESH_LABEL } from "@/components/AutoRefresh";
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
import { FOCUS_COUNT } from "@/lib/focus-provinces";
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
          How the climate is stressing each part of national life. Eight sectors across all{" "}
          {FOCUS_COUNT} provinces. Each panel shows the national shape — how many provinces sit at
          each risk level — then names the worst-affected provinces and the signals behind the
          rating. Scan the bars for red and black — that&apos;s where a sector is under real stress.
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
