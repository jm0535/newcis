// Page 2 — ENSO Climate Intelligence.
import { HistoricalCompare } from "@/components/HistoricalCompare";
import { IndicatorGauge } from "@/components/IndicatorGauge";
import { PageNav } from "@/components/PageNav";
import { StatusBar } from "@/components/StatusBar";
import { ThresholdsPanel } from "@/components/ThresholdsPanel";
import { TrendChart } from "@/components/TrendChart";
import { Card, SectionHeader, EmptyState } from "@/components/ui";
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
    <main className="min-h-screen bg-surface-0 text-text-1">
      <StatusBar national={national} lastRun={lastRun} />
      <PageNav active="/climate" />

      <header className="px-4 md:px-6 py-6 border-b border-border-subtle">
        <div className="text-[10px] uppercase tracking-[0.12em] text-accent font-semibold mb-1">
          ENSO Climate Intelligence
        </div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">NEWCIS</h1>
        <p className="text-xs text-text-muted mt-2 max-w-3xl leading-relaxed">
          Live oceanic + atmospheric indicators driving the national alert level. Threshold
          bands shown on every chart — gauges, trends, and history all read from the same
          config.
        </p>
      </header>

      <div className="px-4 md:px-6 py-6 space-y-8">
        <section aria-label="Live indicators">
          <SectionHeader title="Indicators" description="Latest reading per source" />
          {indicators.length === 0 ? (
            <EmptyState
              title="No indicators yet"
              description="Ingest has not run — trigger a refresh from the Operations page."
            />
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

        <section aria-label="12-month trend">
          <SectionHeader title="12-Month Trend" description="Recent readings vs threshold bands" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {indicators.map((i) => (
              <Card key={i.key} padding="md">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xs uppercase tracking-[0.08em] text-text-muted font-semibold">
                    {i.key}
                  </span>
                  <span className="text-[11px] text-text-muted">{i.unit}</span>
                </div>
                <TrendChart
                  indicatorKey={i.key}
                  history={history}
                  threshold={thresholdByKey.get(i.key)}
                />
              </Card>
            ))}
          </div>
        </section>

        <section aria-label="Historical comparison">
          <SectionHeader
            title="Historical Comparison"
            description="ONI peak vs prior ENSO events. Reference peaks seeded (DEMO); live archive is Phase-2."
          />
          <Card padding="md">
            <HistoricalCompare oni={oni} threshold={thresholdByKey.get("ONI")} />
          </Card>
        </section>

        <section aria-label="Threshold bands">
          <SectionHeader
            title="Threshold Bands"
            description="Edit data/risk_thresholds.json to retune — no code change required."
          />
          <Card padding="md">
            <ThresholdsPanel thresholds={thresholds} />
          </Card>
        </section>
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
