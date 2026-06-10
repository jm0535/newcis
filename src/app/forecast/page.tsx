// Page — ENSO Forecast & Outlook.
//
// Two honest things, never blurred (CLAUDE.md §0):
//   1. RELAY the NMME dynamical seasonal forecast (NOAA-GFDL SPEAR via IRI's open
//      CCSR OPeNDAP) — the genuine model the operational centres run. Shown as an
//      ensemble plume of projected ONI. This is display of an official agency
//      forecast, NOT NEWCIS doing AI forecasting (that's production Phase 3).
//   2. DIAGNOSE precursor alignment — do the present-state ENSO signals (observed
//      ONI, SOI, west-Pacific trade winds) point the same way the model does?
//      Agreement raises confidence; conflict lowers it. A duty-forecaster sanity
//      read, not a model.
//
// The forward-looking projection NEVER raises today's live national alert
// (rollUpNational excludes PROJECTED_ONI) — it informs, it doesn't escalate.
import { DashboardFooter } from "@/components/DashboardFooter";
import { EnsemblePlume } from "@/components/EnsemblePlume";
import { PageNav } from "@/components/PageNav";
import { ProvenanceBadge } from "@/components/Provenance";
import { StatusBar } from "@/components/StatusBar";
import { TrendChart } from "@/components/TrendChart";
import { Card, MetricTile, SectionHeader, EmptyState, StatusPill } from "@/components/ui";
import {
  getForecast,
  getIndicators,
  getLastRun,
  getNationalStatus,
  getReadingsHistory,
  getRiskThresholds,
} from "@/lib/data";
import type { EnsoLean, OutlookConfidence } from "@/lib/outlook";
import { ArrowDownRight, ArrowUpRight, Minus, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

const LEAN_LABEL: Record<EnsoLean, string> = {
  el_nino: "El Niño",
  la_nina: "La Niña",
  neutral: "Neutral",
};

// A lean maps to a traffic-light status only as a VISUAL cue for the outlook
// chips — El Niño and La Niña are both hazards (amber/red feel), neutral is calm.
const LEAN_STATUS: Record<EnsoLean, "green" | "amber"> = {
  el_nino: "amber",
  la_nina: "amber",
  neutral: "green",
};

const CONFIDENCE_LABEL: Record<OutlookConfidence, string> = {
  low: "Low confidence",
  moderate: "Moderate confidence",
  high: "High confidence",
};

function LeanIcon({ lean }: { lean: EnsoLean }) {
  if (lean === "el_nino") return <ArrowUpRight size={14} className="text-status-amber" />;
  if (lean === "la_nina") return <ArrowDownRight size={14} className="text-status-sky" />;
  return <Minus size={14} className="text-text-muted" />;
}

export default async function ForecastPage() {
  const [national, forecast, indicators, history, thresholds, lastRun] = await Promise.all([
    getNationalStatus(),
    getForecast(),
    getIndicators(),
    getReadingsHistory(),
    getRiskThresholds(),
    getLastRun(),
  ]);

  const oniThreshold = thresholds.find((t) => t.metric === "ONI");
  const projThreshold = thresholds.find((t) => t.metric === "PROJECTED_ONI") ?? oniThreshold;
  const projectedIndicator = indicators.find((i) => i.key === "PROJECTED_ONI");
  const model = forecast?.model ?? null;
  const outlook = forecast?.outlook ?? null;

  return (
    <main className="min-h-screen bg-surface-0 text-text-1">
      <StatusBar national={national} lastRun={lastRun} />
      <PageNav active="/forecast" />

      <header className="px-4 md:px-6 py-6 border-b border-border-subtle">
        <div className="text-[10px] uppercase tracking-[0.12em] text-accent font-semibold mb-1">
          NEWCIS
        </div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
          ENSO Forecast &amp; Outlook
        </h1>
        <p className="text-xs text-text-muted mt-2 max-w-3xl leading-relaxed">
          The next-season outlook. We relay the NMME dynamical forecast (the model the
          operational centres run) and check it against the present-state ENSO precursors.
          A forecast informs the operating picture — it never raises today&apos;s live alert.
        </p>
      </header>

      <div className="px-4 md:px-6 py-6 space-y-8">
        {/* 1. The dynamical-model forecast — ensemble plume. */}
        <section aria-label="Dynamical forecast">
          <SectionHeader
            title="Dynamical Forecast — Projected ONI"
            description="NMME multi-member projection of the Niño-3.4 SST anomaly for the forward 3-month window. Each dot is one model member; the spread is the forecast uncertainty."
          />
          {model ? (
            <Card padding="md">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-1">
                    Projected ONI · {model.target_window}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.08em] text-text-muted mt-0.5">
                    {model.source} · init {model.init_month.slice(0, 7)}
                  </div>
                </div>
                <ProvenanceBadge value="LIVE" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <MetricTile
                  label="Ensemble mean"
                  value={
                    <>
                      {model.ensemble_mean.toFixed(2)}
                      <span className="text-base text-text-muted"> °C</span>
                    </>
                  }
                  hint="projected ONI"
                  tone={outlook?.projectedLean === "neutral" ? "green" : "amber"}
                />
                <MetricTile
                  label="Low member"
                  value={
                    <>
                      {model.ensemble_min.toFixed(2)}
                      <span className="text-base text-text-muted"> °C</span>
                    </>
                  }
                  hint="coolest projection"
                />
                <MetricTile
                  label="High member"
                  value={
                    <>
                      {model.ensemble_max.toFixed(2)}
                      <span className="text-base text-text-muted"> °C</span>
                    </>
                  }
                  hint="warmest projection"
                />
                <MetricTile
                  label="Members"
                  value={String(model.members.length)}
                  hint="NMME ensemble"
                />
              </div>

              <EnsemblePlume model={model} threshold={projThreshold} />
            </Card>
          ) : (
            <EmptyState
              title="Model forecast unavailable this cycle"
              description="The seasonal model feed (NMME) didn't report this cycle. The outlook below is still live — it reads today's ENSO signals directly."
            />
          )}
        </section>

        {/* 2. Precursor-alignment outlook. */}
        {outlook && (
          <section aria-label="Outlook">
            <SectionHeader
              title="Outlook — Precursor Alignment"
              description="Do the independent present-state ENSO signals agree with the model's lean? Agreement raises confidence; a signal pulling the other way lowers it. This is a diagnostic read, not a second forecast."
            />
            <Card padding="md">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-accent" />
                  <span className="text-sm font-medium">Model lean</span>
                  <StatusPill status={LEAN_STATUS[outlook.projectedLean]} size="sm">
                    {LEAN_LABEL[outlook.projectedLean]}
                  </StatusPill>
                </div>
                <div className="flex items-center gap-2">
                  <ProvenanceBadge value="LIVE" />
                  <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-text-2">
                    {CONFIDENCE_LABEL[outlook.confidence]}
                  </span>
                </div>
              </div>

              <p className="text-sm text-text-2 leading-relaxed mb-5">{outlook.summary}</p>

              <div className="text-[10px] uppercase tracking-[0.08em] text-text-muted mb-2">
                Present-state precursors
                {outlook.precursorsWithData > 0 && (
                  <>
                    {" "}
                    · {outlook.agreement} of {outlook.precursorsWithData} agree with the model
                  </>
                )}
              </div>
              <ul className="divide-y divide-border-subtle">
                {outlook.precursors.map((p) => {
                  const agrees =
                    outlook.projectedLean !== "neutral" && p.lean === outlook.projectedLean;
                  return (
                    <li key={p.key} className="py-2.5 flex items-start gap-3">
                      <LeanIcon lean={p.lean} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-text-1">{p.label}</span>
                          {p.value !== null && (
                            <span className="text-xs text-text-muted" data-numeric>
                              {p.value}
                              {p.unit ? ` ${p.unit.split(" ")[0]}` : ""}
                            </span>
                          )}
                          {outlook.projectedLean !== "neutral" && p.lean !== "neutral" && (
                            <span
                              className={`text-[10px] uppercase tracking-[0.06em] font-semibold ${
                                agrees ? "text-status-green" : "text-status-amber"
                              }`}
                            >
                              {agrees ? "agrees" : "diverges"}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted leading-relaxed mt-0.5">{p.note}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        )}

        {/* 3. Projected-ONI trend across forecast inits. */}
        {projectedIndicator && (
          <section aria-label="Projected ONI trend">
            <SectionHeader
              title="Projection Trend"
              description="How the projected ONI has shifted across successive monthly forecast inits — is the model trending hotter or cooler than last cycle?"
            />
            <Card padding="md">
              <TrendChart
                indicator={projectedIndicator}
                history={history}
                threshold={projThreshold}
              />
            </Card>
          </section>
        )}

        {/* Scope / honesty note. */}
        <section aria-label="About this forecast">
          <Card padding="md">
            <div className="text-[10px] uppercase tracking-[0.08em] text-text-muted mb-2">
              About this forecast
            </div>
            <p className="text-xs text-text-2 leading-relaxed">
              NEWCIS does not generate its own forecast. It <strong>relays</strong> the NMME
              dynamical model (NOAA-GFDL SPEAR member) served openly by IRI&apos;s CCSR OPeNDAP
              endpoint, and anomalises the projected Niño-3.4 SST against the NOAA ERSSTv5
              1991–2020 climatology to express it as a projected ONI. The precursor-alignment
              read is a deterministic diagnostic over signals NEWCIS already holds. Both are
              badged <span className="text-accent font-semibold">LIVE</span>. AI-driven
              forecasting is production Phase 3, out of scope for this prototype.
            </p>
          </Card>
        </section>
      </div>

      <DashboardFooter lastRun={lastRun} />
    </main>
  );
}
