// Page 2 — ENSO Climate Intelligence.
import { DashboardFooter } from "@/components/DashboardFooter";
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
          NEWCIS
        </div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
          ENSO Climate Intelligence
        </h1>
        <p className="text-xs text-text-muted mt-2 max-w-3xl leading-relaxed">
          Live oceanic + atmospheric indicators driving the national alert level. Threshold
          bands shown on every chart — gauges, trends, and history all read from the same
          config.
        </p>
      </header>

      <div className="px-4 md:px-6 py-6 space-y-8">
        <section aria-label="Live indicators">
          <SectionHeader
            title="Indicators"
            description="Latest reading per signal. The coloured bar shows where today's value sits across the GREEN→AMBER→RED→BLACK bands — the marker is the current value, so a glance answers 'are we in trouble yet?'"
          />
          {indicators.length === 0 ? (
            <EmptyState
              title="No indicators yet"
              description="The data feeds haven't reported yet — refresh from the Operations page to pull the latest readings."
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
          <SectionHeader
            title="12-Month Trend"
            description="Each chart tracks one signal over time. The dashed lines are the alert thresholds — when the trend crosses one, the national level escalates to AMBER, RED, or BLACK."
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-[11px] text-text-muted">
            <span className="font-semibold uppercase tracking-[0.08em]">Threshold lines:</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-status-amber" /> AMBER · ENSO watch
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-status-red" /> RED · ENSO alert
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-status-black" /> BLACK · national emergency
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {indicators.map((i) => (
              <Card key={i.key} padding="md">
                <TrendChart
                  indicator={i}
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
            description="Today's ENSO strength against past El Niño / La Niña events — is this shaping up milder or worse than 1997-98 or 2015-16? Past peaks are reference figures (DEMO); a full live archive comes in a later phase."
          />
          <Card padding="md">
            <HistoricalCompare oni={oni} threshold={thresholdByKey.get("ONI")} />
          </Card>
        </section>

        <section aria-label="Threshold bands">
          <SectionHeader
            title="Alert Thresholds"
            description="The cut-offs that turn each indicator GREEN, AMBER, RED or BLACK. These are the rules behind the traffic-lights — tunable by the analyst team without a rebuild."
          />
          <Card padding="md">
            <ThresholdsPanel thresholds={thresholds} />
          </Card>
        </section>
      </div>

      <DashboardFooter lastRun={lastRun} />
    </main>
  );
}
