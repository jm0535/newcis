// Page 2 — ENSO Climate Intelligence.
// Live indicator gauges, 12-month trend lines, historical comparison strip,
// and the threshold panel that exposes every band edge.
import { HistoricalCompare } from "@/components/HistoricalCompare";
import { IndicatorGauge } from "@/components/IndicatorGauge";
import { PageNav } from "@/components/PageNav";
import { StatusBar } from "@/components/StatusBar";
import { ThresholdsPanel } from "@/components/ThresholdsPanel";
import { TrendChart } from "@/components/TrendChart";
import {
  getIndicators,
  getLastRun,
  getNationalStatus,
  getReadingsHistory,
  getRiskThresholds,
} from "@/lib/data";
import { fmtDateTime } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function ClimatePage() {
  const [national, indicators, history, thresholds, lastRun] = await Promise.all([
    getNationalStatus(),
    getIndicators(),
    getReadingsHistory(),
    getRiskThresholds(),
    getLastRun(),
  ]);

  const thresholdByKey = new Map(thresholds.map((t) => [t.metric, t]));
  const oni = indicators.find((i) => i.key === "ONI");

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <StatusBar national={national} lastRun={lastRun} />
      <PageNav active="/climate" />

      <div className="px-6 py-5 border-b border-zinc-900">
        <h1 className="text-xl font-semibold tracking-tight">
          NEWCIS <span className="text-zinc-500 font-normal">· ENSO Climate Intelligence</span>
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Live oceanic + atmospheric indicators driving the national alert level. Threshold
          bands shown on every chart — gauges, trends, and history all read from the same
          config.
        </p>
      </div>

      <div className="px-6 py-6 space-y-6">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 mb-3">
            Indicators
          </h2>
          {indicators.length === 0 ? (
            <div className="text-sm text-zinc-500 border border-dashed border-zinc-700 rounded-lg p-6">
              No indicators yet — ingest has not run.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {indicators.map((i) => (
                <IndicatorGauge
                  key={i.key}
                  indicator={i}
                  threshold={thresholdByKey.get(i.key)}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 mb-3">
            12-Month Trend
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {indicators.map((i) => (
              <div key={i.key} className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">{i.key}</span>
                  <span className="text-[11px] text-zinc-500">{i.unit}</span>
                </div>
                <TrendChart
                  indicatorKey={i.key}
                  history={history}
                  threshold={thresholdByKey.get(i.key)}
                />
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 mb-3">
            Historical Comparison
          </h2>
          <HistoricalCompare oni={oni} threshold={thresholdByKey.get("ONI")} />
          <p className="mt-2 text-[11px] text-zinc-500">
            Reference peaks seeded (DEMO). Live archive ingestion is a Phase-2 task.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 mb-3">
            Threshold Bands
          </h2>
          <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
            <ThresholdsPanel thresholds={thresholds} />
          </div>
        </section>
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
