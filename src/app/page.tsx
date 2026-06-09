// Landing page — the orientation + credibility gateway at /.
// Frames NEWCIS honestly for BOTH audiences (executives + technical validators)
// before they enter the dense operating picture at /dashboard. Surfaces the live
// national alert, the LIVE/DEMO/REFERENCE provenance model, scope, and data health
// — all from the same real data files the dashboard reads.
import Link from "next/link";
import { LiveClock } from "@/components/LiveClock";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatusPill, Card, Badge } from "@/components/ui";
import { getLastRun, getNationalStatus } from "@/lib/data";
import { FOCUS_COUNT } from "@/lib/focus-provinces";
import { fmtDateTime } from "@/lib/ui";
import type { AlertLevel, NationalStatus } from "@/lib/types";
import {
  ArrowRight,
  Activity,
  Radio,
  Database,
  ShieldCheck,
  CloudSun,
  Map as MapIcon,
  Clock,
} from "lucide-react";

export const dynamic = "force-dynamic";

const ENSO_LABEL: Record<NationalStatus["enso_phase"], string> = {
  neutral: "ENSO Neutral",
  el_nino_watch: "El Niño Watch",
  el_nino_alert: "El Niño Alert",
  la_nina_watch: "La Niña Watch",
  la_nina_alert: "La Niña Alert",
};

const ALERT_STATUS: Record<AlertLevel, "green" | "amber" | "red" | "black"> = {
  GREEN: "green",
  AMBER: "amber",
  RED: "red",
  BLACK: "black",
};

const ALERT_BLURB: Record<AlertLevel, string> = {
  GREEN: "Routine monitoring — no active ENSO signal.",
  AMBER: "ENSO watch — conditions worth close attention.",
  RED: "ENSO alert — elevated national risk.",
  BLACK: "National emergency footing.",
};

const fmtPop = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n.toLocaleString();

export default async function Landing() {
  const [national, lastRun] = await Promise.all([getNationalStatus(), getLastRun()]);

  const alert = national?.alert_level ?? "GREEN";
  const phase = national ? ENSO_LABEL[national.enso_phase] : "ENSO Neutral";
  const sources = lastRun?.sources_ok ?? {};
  const sourceEntries = Object.entries(sources);
  const sourcesOk = sourceEntries.filter(([, ok]) => ok).length;

  return (
    <main className="min-h-screen bg-surface-0 text-text-1 flex flex-col">
      {/* Slim top bar — brand + live clock + theme toggle. */}
      <div className="px-4 md:px-6 py-3 flex items-center gap-3 border-b border-border-subtle">
        <span className="text-sm font-semibold tracking-tight">NEWCIS</span>
        <Badge variant="accent" className="hidden sm:inline-flex">
          Prototype
        </Badge>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-text-muted">
          <Clock size={12} />
          <LiveClock />
        </span>
        <ThemeToggle />
      </div>

      <div className="flex-1 px-4 md:px-6 py-10 md:py-16 max-w-5xl mx-auto w-full">
        {/* Hero */}
        <section aria-label="Mission" className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 mb-5">
            <StatusPill status={ALERT_STATUS[alert]} pulse={alert !== "GREEN"}>
              {alert}
            </StatusPill>
            <span className="text-sm text-text-2 font-medium">{phase}</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.1]">
            National ENSO Early Warning &amp;
            <br className="hidden md:block" /> Climate Intelligence System
          </h1>
          <p className="mt-4 text-sm md:text-base text-text-muted leading-relaxed">
            A national operating picture for Papua New Guinea — turning live climate
            and humanitarian feeds into a traffic-light read of ENSO risk across all{" "}
            <span className="text-text-2" data-numeric>
              {FOCUS_COUNT}
            </span>{" "}
            provinces, with a one-click executive SITREP.
          </p>
          <p className="mt-3 text-xs text-text-muted">
            {ALERT_BLURB[alert]}
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded font-medium uppercase tracking-[0.06em] text-sm px-5 py-2.5 bg-accent text-zinc-950 hover:bg-accent-hover border border-accent transition-colors"
            >
              Enter Operating Picture
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/climate"
              className="inline-flex items-center justify-center gap-2 rounded font-medium uppercase tracking-[0.06em] text-sm px-5 py-2.5 bg-surface-2 text-text-1 hover:bg-surface-3 border border-border-default transition-colors"
            >
              <CloudSun size={15} />
              ENSO Climate
            </Link>
          </div>
        </section>

        {/* Live KPI strip — real numbers from national_status.json */}
        <section
          aria-label="National snapshot"
          className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          {[
            {
              icon: Activity,
              label: "National risk",
              value: (national?.national_risk_rating ?? "—").toUpperCase(),
            },
            {
              icon: MapIcon,
              label: "High-risk provinces",
              value: national?.high_risk_province_count ?? "—",
              numeric: true,
            },
            {
              icon: Radio,
              label: "Population in scope",
              value: national ? fmtPop(national.affected_population_est) : "—",
              numeric: true,
            },
            {
              icon: CloudSun,
              label: "Forecast window",
              value: national?.forecast_period ?? "—",
            },
          ].map((k) => {
            const Icon = k.icon;
            return (
              <Card key={k.label} padding="md" className="text-center">
                <Icon size={14} className="mx-auto text-text-muted mb-1.5" />
                <div
                  className="text-lg md:text-xl font-semibold text-text-1"
                  data-numeric={k.numeric ? "" : undefined}
                >
                  {k.value}
                </div>
                <div className="text-[10px] uppercase tracking-[0.08em] text-text-muted mt-0.5">
                  {k.label}
                </div>
              </Card>
            );
          })}
        </section>

        {/* Credibility model — the LIVE / DEMO / REFERENCE story, upfront. */}
        <section aria-label="Provenance model" className="mt-12">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={14} className="text-accent" />
            <h2 className="text-xs uppercase tracking-[0.1em] font-semibold text-text-2">
              The credibility rule
            </h2>
          </div>
          <p className="text-sm text-text-muted leading-relaxed mb-4">
            Every element on screen carries a provenance badge — so a technical
            reviewer and an executive can both trust exactly what they&apos;re looking
            at. We never present seeded data as live.
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <Card padding="md">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-[0.08em] border bg-status-green/15 text-status-green border-status-green/40">
                <span className="w-1 h-1 rounded-full bg-status-green animate-pulse" />
                LIVE
              </span>
              <p className="mt-2 text-xs text-text-muted leading-relaxed">
                Pulled from a real API this cycle — NOAA ONI, HDX food security &amp;
                rainfall, ACLED, USGS, GDACS.
              </p>
            </Card>
            <Card padding="md">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-[0.08em] border bg-status-amber/15 text-status-amber border-status-amber/40">
                <span className="w-1 h-1 rounded-full bg-status-amber" />
                DEMO
              </span>
              <p className="mt-2 text-xs text-text-muted leading-relaxed">
                Seeded placeholder where no clean public feed exists yet — water,
                health, energy, infrastructure.
              </p>
            </Card>
            <Card padding="md">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-[0.08em] border bg-surface-2 text-text-muted border-border-default">
                <span className="w-1 h-1 rounded-full bg-text-muted" />
                REFERENCE
              </span>
              <p className="mt-2 text-xs text-text-muted leading-relaxed">
                Curated historical record — the hand-compiled volcano, tsunami &amp;
                disaster hazard map layers.
              </p>
            </Card>
          </div>
        </section>

        {/* Scope — what's in the slice. */}
        <section aria-label="Scope" className="mt-12 grid md:grid-cols-3 gap-3">
          <Card padding="lg">
            <MapIcon size={16} className="text-text-muted mb-2" />
            <div className="text-sm font-semibold text-text-1">All 22 provinces</div>
            <p className="mt-1 text-xs text-text-muted leading-relaxed">
              A province-agnostic risk engine scores every PNG province, coloured on an
              interactive heat map with toggleable hazard layers.
            </p>
          </Card>
          <Card padding="lg">
            <CloudSun size={16} className="text-text-muted mb-2" />
            <div className="text-sm font-semibold text-text-1">7 climate indicators</div>
            <p className="mt-1 text-xs text-text-muted leading-relaxed">
              ONI, SOI, SST, rainfall, temperature, soil moisture and vegetation health
              — gauged against config-driven traffic-light thresholds.
            </p>
          </Card>
          <Card padding="lg">
            <Database size={16} className="text-text-muted mb-2" />
            <div className="text-sm font-semibold text-text-1">8 sectoral panels</div>
            <p className="mt-1 text-xs text-text-muted leading-relaxed">
              Food, water, health, economy, infrastructure, energy, social stability and
              disaster &amp; hazard — each badged for provenance.
            </p>
          </Card>
        </section>
      </div>

      {/* Data-health footer — real source status from last_run.json. */}
      <footer className="border-t border-border-subtle px-4 md:px-6 py-3 text-[11px] text-text-muted flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          {sourceEntries.length > 0 && (
            <span
              className="flex items-center gap-1.5"
              aria-label={`${sourcesOk} of ${sourceEntries.length} sources OK this cycle`}
            >
              {sourceEntries.map(([k, ok]) => (
                <span
                  key={k}
                  title={k}
                  className={`w-2 h-2 rounded-full ${ok ? "bg-status-green" : "bg-status-red"}`}
                />
              ))}
            </span>
          )}
          <span data-numeric>
            {sourcesOk}/{sourceEntries.length || "—"}
          </span>{" "}
          sources LIVE · last ingest{" "}
          <span className="text-text-2" data-numeric>
            {fmtDateTime(lastRun?.finished_at ?? national?.updated_at)}
          </span>
        </span>
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
