// Static landing-page sections. Split out of page.tsx (500-line budget): these
// four sections carry no live data — they are the capability gallery, the
// why-early-warning editorial band, the provenance credibility band, and the
// scope cards. The page composes them between the live hero and footer.
import Link from "next/link";
import { Card } from "@/components/ui";
import { ProvenanceBadge } from "@/components/Provenance";
import {
  ArrowRight,
  Database,
  ShieldCheck,
  CloudSun,
  Map as MapIcon,
} from "lucide-react";
import { CAPABILITIES, TONE_CLASS } from "./constants";

export function CapabilityGallery() {
  return (
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
  );
}

export function WhyEarlyWarning() {
  return (
    <section aria-label="Why early warning" className="mx-auto max-w-7xl px-4 md:px-6 py-14">
      <Card padding="none" className="overflow-hidden">
        <div className="grid md:grid-cols-2">
          {/* Image side — contained, framed, never behind text. */}
          <figure className="relative m-0 min-h-[220px] md:min-h-[320px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/img/disaster_png.jpg"
              alt="Post-Courier front page: 21 dead from landslides, flooding and king tides across Papua New Guinea, March 2024"
              className="h-full w-full object-cover object-center select-none"
              draggable={false}
            />
            <figcaption className="absolute bottom-0 inset-x-0 px-3 py-1.5 text-[11px] md:text-[10px] tracking-[0.04em] text-white/90 bg-gradient-to-t from-black/70 to-transparent">
              Post-Courier front page, March 2024 — documented event, not a live
              reading.
            </figcaption>
          </figure>
          {/* Copy side. */}
          <div className="p-6 md:p-8 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={14} className="text-accent" />
              <h2 className="text-xs uppercase tracking-[0.1em] font-semibold text-text-2">
                Why early warning
              </h2>
            </div>
            <p className="text-lg md:text-xl font-semibold tracking-tight text-text-1 leading-snug mb-3">
              When an ENSO season turns, the cost in Papua New Guinea is measured
              in lives.
            </p>
            <p className="text-sm text-text-muted leading-relaxed">
              Landslides, flooding and king tides have repeatedly hit PNG
              communities with little warning. NEWCIS turns the climate signals
              that precede these events into a single, glanceable national
              operating picture — so a watch becomes action before it becomes a
              headline.
            </p>
          </div>
        </div>
      </Card>
    </section>
  );
}

export function CredibilityBand() {
  return (
    <section aria-label="Provenance model" className="border-y border-border-subtle">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-16">
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
          <Card padding="lg">
            <ProvenanceBadge value="LIVE" />
            <p className="mt-2.5 text-xs text-text-muted leading-relaxed">
              Pulled from a real API this cycle — NOAA ONI, HDX food security &amp;
              rainfall, ACLED, USGS, GDACS.
            </p>
          </Card>
          <Card padding="lg">
            <ProvenanceBadge value="DEMO" />
            <p className="mt-2.5 text-xs text-text-muted leading-relaxed">
              Seeded placeholder where no clean public feed exists yet — water,
              health, energy, infrastructure.
            </p>
          </Card>
          <Card padding="lg">
            <ProvenanceBadge value="REFERENCE" />
            <p className="mt-2.5 text-xs text-text-muted leading-relaxed">
              Curated historical record — the hand-compiled volcano, tsunami &amp;
              disaster hazard map layers.
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
}

export function ScopeSection() {
  return (
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
  );
}
