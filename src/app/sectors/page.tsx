// Page 3 — Sectoral Impact.
// One panel per sector with lead agency, focus-province risk cells, driving
// indicators, and provenance badge. Engine produces every cell; upstream
// HDX rows escalate the relevant cells where present.
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
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <StatusBar national={national} lastRun={lastRun} />
      <PageNav active="/sectors" />

      <div className="px-6 py-5 border-b border-zinc-900">
        <h1 className="text-xl font-semibold tracking-tight">
          NEWCIS <span className="text-zinc-500 font-normal">· Sectoral Impact</span>
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Seven sectors, four focus provinces, traffic-light coloured. Each cell carries the
          engine's verdict; tooltip shows provenance and data source.
        </p>
      </div>

      <div className="px-6 py-6">
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

      <footer className="border-t border-zinc-900 px-6 py-3 text-[11px] text-zinc-500 flex flex-wrap justify-between gap-2">
        <span>
          Last ingest:{" "}
          <span className="text-zinc-300 font-mono">{fmtDateTime(lastRun?.finished_at)}</span>
        </span>
        <span>newcis.in4metrix.dev</span>
      </footer>
    </main>
  );
}
