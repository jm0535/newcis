// Landing page — the enterprise-grade orientation + credibility gateway at /.
// Framed in the spirit of a geospatial portal (ArcGIS Living Atlas): a LIVE map
// of the national picture *is* the hero, capabilities are presented as a curated
// content gallery with authority (provenance) badges, and editorial photo bands
// give the page depth. Everything reads from the SAME real data files the
// dashboard uses — national alert, KPIs, source health — so the credibility rule
// holds end to end: we never present DEMO/illustrative content as LIVE.
import type { ReactNode } from "react";
import Link from "next/link";
import { LiveClock } from "@/components/LiveClock";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HeroMap } from "@/components/HeroMap";
import { PartnerMarquee } from "@/components/PartnerMarquee";
import { Badge, MetricTile } from "@/components/ui";
import { getLastRun, getNationalStatus, getSectorRisk } from "@/lib/data";
import { FOCUS_COUNT } from "@/lib/focus-provinces";
import { fmtDateTime } from "@/lib/ui";
import { ArrowRight, CloudSun, FileText, Clock, Radio } from "lucide-react";
import {
  ALERT_BLURB,
  ALERT_DOT,
  ALERT_TEXT,
  ENSO_LABEL,
  fmtPop,
  KPI_ICONS,
  NAV,
} from "./landing/constants";
import {
  CapabilityGallery,
  CredibilityBand,
  ScopeSection,
  WhyEarlyWarning,
} from "./landing/sections";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const [national, lastRun, sectorRisk] = await Promise.all([
    getNationalStatus(),
    getLastRun(),
    getSectorRisk(),
  ]);

  const alert = national?.alert_level ?? "GREEN";
  const phase = national ? ENSO_LABEL[national.enso_phase] : "ENSO Neutral";
  const sources = lastRun?.sources_ok ?? {};
  const sourceEntries = Object.entries(sources);
  const sourcesOk = sourceEntries.filter(([, ok]) => ok).length;

  // Tone per KPI so the snapshot band reads as a vibrant signal, not a row of
  // blank white cards: risk + province count are coloured by severity, the two
  // informational tiles take brand sky/accent.
  type Tone = "green" | "amber" | "red" | "black" | "sky" | "accent";
  const riskTone: Tone = (
    { low: "green", med: "amber", high: "red", critical: "black" } as const
  )[national?.national_risk_rating ?? "low"];
  const hi = national?.high_risk_province_count ?? 0;
  const provinceTone: Tone = hi === 0 ? "green" : hi <= 3 ? "amber" : hi <= 8 ? "red" : "black";

  const kpis: { icon: typeof KPI_ICONS.Activity; label: string; value: ReactNode; tone: Tone }[] = [
    {
      icon: KPI_ICONS.Activity,
      label: "National risk",
      value: (national?.national_risk_rating ?? "—").toUpperCase(),
      tone: riskTone,
    },
    {
      icon: KPI_ICONS.MapIcon,
      label: "High-risk provinces",
      value: national?.high_risk_province_count ?? "—",
      tone: provinceTone,
    },
    {
      icon: KPI_ICONS.Radio,
      label: "Population in scope",
      value: national ? fmtPop(national.affected_population_est) : "—",
      tone: "sky" as const,
    },
    {
      icon: KPI_ICONS.CloudSun,
      label: "Forecast window",
      value: national?.forecast_period ?? "—",
      tone: "accent" as const,
    },
  ];

  return (
    <main className="min-h-screen bg-surface-0 text-text-1">
      {/* Sticky enterprise nav — brand, primary sections, live clock, enter CTA. */}
      <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface-0/85 backdrop-blur supports-[backdrop-filter]:bg-surface-0/70">
        <div className="mx-auto max-w-7xl px-4 md:px-6 h-14 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            {/* Brand mark = the app favicon (the gauge), so the tab icon and the
                in-page logo are one consistent identity. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon-gauge.svg"
              alt="NEWCIS"
              width={28}
              height={28}
              className="h-7 w-7 rounded shrink-0"
            />
            <span className="text-sm font-semibold tracking-tight">NEWCIS</span>
            <Badge variant="accent" className="hidden sm:inline-flex">
              Prototype
            </Badge>
          </Link>

          <nav
            aria-label="Primary"
            className="ml-2 hidden md:flex items-center gap-1 text-xs"
          >
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="px-2.5 py-1.5 rounded uppercase tracking-[0.08em] font-medium text-text-muted hover:text-text-1 hover:bg-surface-2 transition-colors"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden lg:flex items-center gap-1.5 text-xs text-text-muted">
              <Clock size={12} />
              <LiveClock />
            </span>
            <ThemeToggle />
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex items-center gap-1.5 rounded font-medium uppercase tracking-[0.06em] text-xs px-3 py-1.5 bg-accent text-accent-foreground hover:bg-accent-hover transition-colors"
            >
              Enter
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO — the live national map IS the backdrop. min-height guarantees the
          absolutely-positioned map has a real box to fill (without it the map
          container collapses to MapLibre's default and the tint barely shows). */}
      <section
        aria-label="Mission"
        className="relative overflow-hidden border-b border-border-subtle min-h-[560px] md:min-h-[640px] flex flex-col"
      >
        <HeroMap sectorRisk={sectorRisk} />
        {/* Scrim keeps the overlaid copy legible over the map. */}
        <div className="absolute inset-0 bg-gradient-to-b from-surface-0/70 via-surface-0/40 to-surface-0/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-surface-0/80 to-transparent" />

        <div className="relative z-10 flex-1 w-full mx-auto max-w-7xl px-4 md:px-6 py-20 md:py-28 flex items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-0/70 backdrop-blur px-3 py-1 mb-5">
              <span
                className={`h-2 w-2 rounded-full ${ALERT_DOT[alert]} ${alert !== "GREEN" ? "animate-pulse" : ""}`}
              />
              <span className={`text-xs font-semibold tracking-[0.08em] ${ALERT_TEXT[alert]}`}>
                {alert}
              </span>
              <span className="text-xs text-text-muted">· {phase}</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
              National ENSO Early Warning
              <br className="hidden md:block" /> &amp; Climate Intelligence
            </h1>
            <p className="mt-5 text-sm md:text-lg text-text-2 leading-relaxed max-w-xl">
              Live ENSO risk for Papua New Guinea, across all{" "}
              <span className="text-text-1 font-medium" data-numeric>
                {FOCUS_COUNT}
              </span>{" "}
              provinces — climate and humanitarian feeds distilled into one
              traffic-light picture, with one-click situation reports.
            </p>
            <p className="mt-3 text-xs md:text-sm text-text-muted">{ALERT_BLURB[alert]}</p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded font-medium uppercase tracking-[0.06em] text-sm px-6 py-3 bg-accent text-accent-foreground hover:bg-accent-hover border border-accent transition-colors"
              >
                Enter Operating Picture
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/climate"
                className="inline-flex items-center justify-center gap-2 rounded font-medium uppercase tracking-[0.06em] text-sm px-6 py-3 bg-surface-1/80 backdrop-blur text-text-1 hover:bg-surface-2 border border-border-default transition-colors"
              >
                <CloudSun size={15} />
                ENSO Climate
              </Link>
              <Link
                href="/operations#sitrep"
                className="inline-flex items-center justify-center gap-2 rounded font-medium uppercase tracking-[0.06em] text-sm px-6 py-3 bg-surface-1/80 backdrop-blur text-text-1 hover:bg-surface-2 border border-border-default transition-colors"
              >
                <FileText size={15} />
                Weekly SITREP
              </Link>
            </div>
          </div>
        </div>

        {/* Caption: the backdrop is live data, named honestly. */}
        <div className="relative mx-auto max-w-7xl px-4 md:px-6 pb-4">
          <span className="inline-flex items-center gap-1.5 text-[11px] md:text-[10px] uppercase tracking-[0.08em] text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-status-green animate-pulse" />
            Live national risk map · touring real risk &amp; hazard sites
          </span>
        </div>
      </section>

      {/* LIVE STATUS BAND — bigger KPIs + source-health, the operational tell. */}
      <section
        aria-label="National snapshot"
        className="border-b border-border-subtle bg-surface-1"
      >
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-8">
          <div className="flex items-center justify-between gap-3 mb-5">
            <h2 className="text-xs uppercase tracking-[0.1em] font-semibold text-text-2">
              National snapshot
            </h2>
            <span className="flex items-center gap-2 text-[11px] text-text-muted">
              {sourceEntries.length > 0 && (
                <span
                  className="flex items-center gap-1"
                  aria-label={`${sourcesOk} of ${sourceEntries.length} sources OK this cycle`}
                >
                  {sourceEntries.map(([k, ok]) => (
                    <span
                      key={k}
                      title={k}
                      className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-status-green" : "bg-status-red"}`}
                    />
                  ))}
                </span>
              )}
              <span data-numeric>
                {sourcesOk}/{sourceEntries.length || "—"}
              </span>{" "}
              sources LIVE
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpis.map((k) => {
              const Icon = k.icon;
              return (
                <MetricTile
                  key={k.label}
                  icon={<Icon size={12} />}
                  label={k.label}
                  value={k.value}
                  tone={k.tone}
                />
              );
            })}
          </div>
        </div>
      </section>

      <CapabilityGallery />

      <WhyEarlyWarning />

      <CredibilityBand />

      <ScopeSection />

      {/* DATA SOURCES — an animated, edge-faded marquee of the real feeds behind
          the picture. These are publicly-available open data sources, NOT formal
          partners: no agreement or deal exists. The chips are self-drawn (no
          copied agency logos). */}
      <section
        aria-label="Data sources"
        className="border-t border-border-subtle bg-surface-1"
      >
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-12">
          <div className="flex items-center gap-2 mb-6">
            <Radio size={14} className="text-accent" />
            <h2 className="text-xs uppercase tracking-[0.1em] font-semibold text-text-2">
              Powered by trusted data sources
            </h2>
          </div>
          <PartnerMarquee />
        </div>
      </section>

      {/* FOOTER — health + brand. */}
      <footer className="border-t border-border-subtle bg-surface-1">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-8">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-text-muted">
            <span className="flex items-center gap-1.5">
              <span data-numeric>
                {sourcesOk}/{sourceEntries.length || "—"}
              </span>{" "}
              sources LIVE · last ingest{" "}
              <span className="text-text-2" data-numeric>
                {fmtDateTime(lastRun?.finished_at ?? national?.updated_at)}
              </span>
            </span>
            <span>
              Developed by{" "}
              <a
                href="https://www.in4metrix.dev"
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                in4metrix
              </a>
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
