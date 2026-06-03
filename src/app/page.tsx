// Page 1 — Executive Strategic Overview.
// Server component: reads JSON straight off disk, hydrates the dashboard with
// last-good state. The map is the only client island.
import { HeatMap } from "@/components/HeatMap";
import { KpiStrip } from "@/components/KpiStrip";
import { ProvenanceBadge } from "@/components/Provenance";
import { RiskMatrix } from "@/components/RiskMatrix";
import { StatusBar } from "@/components/StatusBar";
import { getLastRun, getNationalStatus, getSectorRisk } from "@/lib/data";
import { fmtDateTime } from "@/lib/ui";

// data/ changes on every ingest commit — Next will rebuild on push, but force
// dynamic so dev mode reflects fresh writes immediately too.
export const dynamic = "force-dynamic";

export default async function Home() {
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
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <StatusBar national={national} lastRun={lastRun} />

      <div className="px-6 py-5 border-b border-zinc-900 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          NEWCIS <span className="text-zinc-500 font-normal">· Executive Strategic Overview</span>
        </h1>
        <span className="text-xs uppercase tracking-wider text-zinc-500">
          Papua New Guinea · {liveSourceCount}/{totalSources} sources LIVE
        </span>
        <span className="ml-auto inline-flex items-center gap-2 px-2 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/40 text-[10px] uppercase tracking-wider font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Prototype
        </span>
      </div>

      <div className="px-6 py-6 space-y-6">
        <section>
          <KpiStrip national={national} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <section className="lg:col-span-2 border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
                National Risk Matrix
              </h2>
              <span className="text-[10px] text-zinc-500">Engine-derived · per focus province</span>
            </div>
            <RiskMatrix sectorRisk={sectorRisk} />
            <div className="mt-3 text-[11px] text-zinc-500 flex flex-wrap gap-2">
              {Array.from(new Set(sectorRisk.map((r) => r.provenance))).map((p) => (
                <ProvenanceBadge key={p} value={p} />
              ))}
              <span>cells carry the worst risk across drivers; trend from prior ingest.</span>
            </div>
          </section>

          <section className="lg:col-span-3 border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
                Provincial Heat Map
              </h2>
              <span className="text-[10px] text-zinc-500">Click a province for detail</span>
            </div>
            <HeatMap sectorRisk={sectorRisk} />
          </section>
        </div>
      </div>

      <footer className="border-t border-zinc-900 px-6 py-3 text-[11px] text-zinc-500 flex flex-wrap justify-between gap-2">
        <span>
          Last ingest:{" "}
          <span className="text-zinc-300 font-mono">
            {fmtDateTime(lastRun?.finished_at)}
          </span>
          {lastRun && <span className="ml-2 text-zinc-600">· {lastRun.notes}</span>}
        </span>
        <span>newcis.in4metrix.dev</span>
      </footer>
    </main>
  );
}
