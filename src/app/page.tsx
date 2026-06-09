// Landing page — the enterprise-grade orientation + credibility gateway at /.
// Framed in the spirit of a geospatial portal (ArcGIS Living Atlas): a LIVE map
// of the national picture *is* the hero, capabilities are presented as a curated
// content gallery with authority (provenance) badges, and editorial photo bands
// give the page depth. Everything reads from the SAME real data files the
// dashboard uses — national alert, KPIs, source health — so the credibility rule
// holds end to end: we never present DEMO/illustrative content as LIVE.
import Link from "next/link";
import { LiveClock } from "@/components/LiveClock";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HeroMap } from "@/components/HeroMap";
import { BandImage } from "@/components/BandImage";
import { Card, Badge } from "@/components/ui";
import { getLastRun, getNationalStatus, getSectorRisk } from "@/lib/data";
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
  Grid3x3,
  FileText,
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

const ALERT_DOT: Record<AlertLevel, string> = {
  GREEN: "bg-status-green",
  AMBER: "bg-status-amber",
  RED: "bg-status-red",
  BLACK: "bg-status-black",
};

const ALERT_TEXT: Record<AlertLevel, string> = {
  GREEN: "text-status-green",
  AMBER: "text-status-amber",
  RED: "text-status-red",
  BLACK: "text-text-1",
};

const ALERT_BLURB: Record<AlertLevel, string> = {
  GREEN: "Routine monitoring — no active ENSO signal.",
  AMBER: "ENSO watch — conditions worth close attention.",
  RED: "ENSO alert — elevated national risk.",
  BLACK: "National emergency footing.",
};

const fmtPop = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n.toLocaleString();

// Primary nav, mirrored from PageNav so the landing page reads as the same
// product. Links jump straight into the operating picture.
const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/climate", label: "ENSO Climate" },
  { href: "/sectors", label: "Sectoral Impact" },
  { href: "/operations", label: "Operations" },
];

// The "what's inside" gallery — each capability as a content card with its own
// provenance signature, the way a geospatial portal surfaces featured layers.
const CAPABILITIES = [
  {
    href: "/dashboard",
    icon: Grid3x3,
    title: "National Risk Matrix",
    body: "Every sector × province, traffic-light coloured and sorted worst-first — the primary executive artifact.",
    tag: "LIVE + DEMO",
    tone: "mixed" as const,
  },
  {
    href: "/dashboard",
    icon: MapIcon,
    title: "Provincial Heat Map",
    body: "All 22 provinces on an interactive map with toggleable volcano, tsunami and disaster hazard layers.",
    tag: "LIVE + REFERENCE",
    tone: "mixed" as const,
  },
  {
    href: "/climate",
    icon: CloudSun,
    title: "ENSO Climate Intelligence",
    body: "ONI, SOI, SST and rainfall gauged against config-driven thresholds, with 12-month trend lines.",
    tag: "LIVE",
    tone: "live" as const,
  },
  {
    href: "/operations",
    icon: FileText,
    title: "Weekly SITREP",
    body: "One-click executive situation report — national status, top movers and recommended actions.",
    tag: "GENERATED",
    tone: "neutral" as const,
  },
];

const TONE_CLASS: Record<"live" | "mixed" | "neutral", string> = {
  live: "bg-status-green/15 text-status-green border-status-green/40",
  mixed: "bg-accent/15 text-accent border-accent/40",
  neutral: "bg-surface-2 text-text-muted border-border-default",
};

// Data partners surfaced in the footer — the "trusted sources" row that signals
// a real pipeline behind the picture.
const PARTNERS = ["NOAA CPC", "NASA", "BoM", "HDX HAPI", "ACLED", "USGS", "GDACS"];

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

  const kpis = [
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
  ];

  return (
    <main className="min-h-screen bg-surface-0 text-text-1">
      {/* Sticky enterprise nav — brand, primary sections, live clock, enter CTA. */}
      <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface-0/85 backdrop-blur supports-[backdrop-filter]:bg-surface-0/70">
        <div className="mx-auto max-w-7xl px-4 md:px-6 h-14 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="grid h-7 w-7 place-items-center rounded bg-accent text-zinc-950">
              <ShieldCheck size={15} />
            </span>
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
              className="hidden sm:inline-flex items-center gap-1.5 rounded font-medium uppercase tracking-[0.06em] text-xs px-3 py-1.5 bg-accent text-zinc-950 hover:bg-accent-hover transition-colors"
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

        <div className="relative flex-1 w-full mx-auto max-w-7xl px-4 md:px-6 py-20 md:py-28 flex items-center">
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
              A national operating picture for Papua New Guinea — turning live
              climate and humanitarian feeds into a traffic-light read of ENSO risk
              across all{" "}
              <span className="text-text-1 font-medium" data-numeric>
                {FOCUS_COUNT}
              </span>{" "}
              provinces, with a one-click executive SITREP.
            </p>
            <p className="mt-3 text-xs md:text-sm text-text-muted">{ALERT_BLURB[alert]}</p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded font-medium uppercase tracking-[0.06em] text-sm px-6 py-3 bg-accent text-zinc-950 hover:bg-accent-hover border border-accent transition-colors"
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
            </div>
          </div>
        </div>

        {/* Caption: the backdrop is live data, named honestly. */}
        <div className="relative mx-auto max-w-7xl px-4 md:px-6 pb-4">
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-status-green animate-pulse" />
            Live national risk map · focus provinces tinted by worst sector risk
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
                <div
                  key={k.label}
                  className="rounded-lg border border-border-subtle bg-surface-0 px-4 py-5"
                >
                  <Icon size={14} className="text-text-muted mb-2" />
                  <div
                    className="text-2xl md:text-3xl font-semibold text-text-1 leading-none"
                    data-numeric={k.numeric ? "" : undefined}
                  >
                    {k.value}
                  </div>
                  <div className="mt-2 text-[10px] uppercase tracking-[0.08em] text-text-muted">
                    {k.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* WHAT'S INSIDE — capability gallery (featured-content cards). */}
      <section aria-label="What's inside" className="mx-auto max-w-7xl px-4 md:px-6 py-14">
        <div className="flex items-center gap-2 mb-2">
          <Database size={14} className="text-accent" />
          <h2 className="text-xs uppercase tracking-[0.1em] font-semibold text-text-2">
            What&apos;s inside
          </h2>
        </div>
        <p className="text-sm text-text-muted mb-6 max-w-2xl">
          Four linked views over one pipeline. Each carries its own provenance
          signature — so a technical reviewer and an executive can both trust
          exactly what they&apos;re looking at.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CAPABILITIES.map((c) => {
            const Icon = c.icon;
            return (
              <Link key={c.title} href={c.href} className="group">
                <Card
                  padding="lg"
                  className="h-full transition-colors group-hover:border-border-default group-hover:bg-surface-2"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="grid h-9 w-9 place-items-center rounded-md bg-surface-2 text-text-2 group-hover:text-accent transition-colors">
                      <Icon size={17} />
                    </span>
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-[0.08em] border ${TONE_CLASS[c.tone]}`}
                    >
                      {c.tag}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-text-1 flex items-center gap-1">
                    {c.title}
                    <ArrowRight
                      size={13}
                      className="text-text-muted opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-text-muted leading-relaxed">{c.body}</p>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* CREDIBILITY BAND — the LIVE/DEMO/REFERENCE model over a photo backdrop. */}
      <section aria-label="Provenance model" className="relative border-y border-border-subtle">
        <BandImage
          src="band-highlands.jpg"
          alt="Drought-stressed highland valley, Papua New Guinea (illustrative)"
          scrimClassName="bg-gradient-to-br from-surface-0 via-surface-0/92 to-surface-0/80"
        />
        <div className="relative mx-auto max-w-7xl px-4 md:px-6 py-16">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={14} className="text-accent" />
            <h2 className="text-xs uppercase tracking-[0.1em] font-semibold text-text-2">
              The credibility rule
            </h2>
          </div>
          <p className="text-sm md:text-base text-text-2 leading-relaxed mb-6 max-w-2xl">
            Every element on screen carries a provenance badge. We never present
            seeded data as live — that&apos;s what lets one prototype satisfy both a
            feasibility review and an executive briefing.
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <Card padding="lg" className="bg-surface-1/80 backdrop-blur">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-[0.08em] border bg-status-green/15 text-status-green border-status-green/40">
                <span className="h-1 w-1 rounded-full bg-status-green animate-pulse" />
                LIVE
              </span>
              <p className="mt-2.5 text-xs text-text-muted leading-relaxed">
                Pulled from a real API this cycle — NOAA ONI, HDX food security &amp;
                rainfall, ACLED, USGS, GDACS.
              </p>
            </Card>
            <Card padding="lg" className="bg-surface-1/80 backdrop-blur">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-[0.08em] border bg-status-amber/15 text-status-amber border-status-amber/40">
                <span className="h-1 w-1 rounded-full bg-status-amber" />
                DEMO
              </span>
              <p className="mt-2.5 text-xs text-text-muted leading-relaxed">
                Seeded placeholder where no clean public feed exists yet — water,
                health, energy, infrastructure.
              </p>
            </Card>
            <Card padding="lg" className="bg-surface-1/80 backdrop-blur">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-[0.08em] border bg-surface-2 text-text-muted border-border-default">
                <span className="h-1 w-1 rounded-full bg-text-muted" />
                REFERENCE
              </span>
              <p className="mt-2.5 text-xs text-text-muted leading-relaxed">
                Curated historical record — the hand-compiled volcano, tsunami &amp;
                disaster hazard map layers.
              </p>
            </Card>
          </div>
          <p className="mt-4 text-[10px] uppercase tracking-[0.08em] text-text-disabled">
            Backdrop imagery is illustrative — not live event photography.
          </p>
        </div>
      </section>

      {/* SCOPE — what's in the slice. */}
      <section aria-label="Scope" className="mx-auto max-w-7xl px-4 md:px-6 py-14">
        <div className="flex items-center gap-2 mb-6">
          <MapIcon size={14} className="text-accent" />
          <h2 className="text-xs uppercase tracking-[0.1em] font-semibold text-text-2">
            Scope of the slice
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Card padding="lg">
            <MapIcon size={16} className="text-text-muted mb-2" />
            <div className="text-sm font-semibold text-text-1">All 22 provinces</div>
            <p className="mt-1 text-xs text-text-muted leading-relaxed">
              A province-agnostic risk engine scores every PNG province, coloured on
              an interactive heat map with toggleable hazard layers.
            </p>
          </Card>
          <Card padding="lg">
            <CloudSun size={16} className="text-text-muted mb-2" />
            <div className="text-sm font-semibold text-text-1">7 climate indicators</div>
            <p className="mt-1 text-xs text-text-muted leading-relaxed">
              ONI, SOI, SST, rainfall, temperature, soil moisture and vegetation
              health — gauged against config-driven traffic-light thresholds.
            </p>
          </Card>
          <Card padding="lg">
            <Database size={16} className="text-text-muted mb-2" />
            <div className="text-sm font-semibold text-text-1">8 sectoral panels</div>
            <p className="mt-1 text-xs text-text-muted leading-relaxed">
              Food, water, health, economy, infrastructure, energy, social stability
              and disaster &amp; hazard — each badged for provenance.
            </p>
          </Card>
        </div>
      </section>

      {/* FOOTER — data-partner row + health + brand. */}
      <footer className="border-t border-border-subtle bg-surface-1">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5">
            <span className="text-[10px] uppercase tracking-[0.1em] text-text-disabled">
              Data partners
            </span>
            {PARTNERS.map((p) => (
              <span key={p} className="text-xs text-text-muted">
                {p}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-5 border-t border-border-subtle text-[11px] text-text-muted">
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
          </div>
        </div>
      </footer>
    </main>
  );
}
