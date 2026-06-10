// Page-1 header KPI cards: ENSO phase, national alert level, risk rating,
// affected population estimate, # high-risk provinces, forecast period.
// Glanceable from across an ops centre — large numerals, single colour cue per card.
import type { NationalStatus } from "@/lib/types";
import { FOCUS_COUNT } from "@/lib/focus-provinces";
import { MetricTile, EmptyState } from "./ui";
import { ProvenanceBadge } from "./Provenance";
import { Activity, AlertTriangle, Gauge, Users, MapPin, CalendarRange } from "lucide-react";

const PHASE_SHORT: Record<NationalStatus["enso_phase"], string> = {
  neutral: "Neutral",
  el_nino_watch: "El Niño Watch",
  el_nino_alert: "El Niño Alert",
  la_nina_watch: "La Niña Watch",
  la_nina_alert: "La Niña Alert",
};

// One-line plain-English hint per phase — what it means for PNG, so a non-technical
// reader gets the "so what" without knowing the science.
const PHASE_HINT: Record<NationalStatus["enso_phase"], string> = {
  neutral: "Pacific in a normal state — no El Niño or La Niña forcing.",
  el_nino_watch: "Conditions building toward El Niño — drought/frost risk rising.",
  el_nino_alert: "El Niño underway — highland drought & frost likely.",
  la_nina_watch: "Conditions building toward La Niña — flood risk rising.",
  la_nina_alert: "La Niña underway — heavy rain & flooding likely.",
};

// What each alert level means as an instruction to leadership.
const ALERT_HINT: Record<NationalStatus["alert_level"], string> = {
  GREEN: "Routine — normal monitoring.",
  AMBER: "Watch — brief sector leads, verify readiness.",
  RED: "Alert — pre-position supplies, advise focus provinces.",
  BLACK: "Emergency — activate national operations centre.",
};

const RISK_HINT: Record<NationalStatus["national_risk_rating"], string> = {
  low: "Few sectors stressed across focus provinces.",
  med: "Several sectors stressed — monitor closely.",
  high: "Many sectors stressed — action needed now.",
  critical: "Widespread severe stress — crisis footing.",
};

const ALERT_TONE = {
  GREEN: "green",
  AMBER: "amber",
  RED: "red",
  BLACK: "black",
} as const;

const RISK_TONE = {
  low: "green",
  med: "amber",
  high: "red",
  critical: "black",
} as const;

// ENSO phase tile is informational, not a traffic-light — but a flat white card
// reads as "no signal". Colour it by what the phase means: El Niño (drought/frost)
// runs warm amber→red, La Niña (flood) runs sky, neutral stays brand accent.
const PHASE_TONE: Record<NationalStatus["enso_phase"], "accent" | "amber" | "red" | "sky"> = {
  neutral: "accent",
  el_nino_watch: "amber",
  el_nino_alert: "red",
  la_nina_watch: "sky",
  la_nina_alert: "sky",
};

export function KpiStrip({ national }: { national: NationalStatus | null }) {
  if (!national) {
    return (
      <EmptyState
        title="No national status"
        description="Ingest has not run yet — trigger a refresh to populate."
      />
    );
  }

  const affected = national.affected_population_est;
  const affectedLabel = affected > 0 ? affected.toLocaleString() : "—";

  // High-risk province count: more stressed provinces = hotter tile.
  const hi = national.high_risk_province_count;
  const provinceTone = hi === 0 ? "green" : hi <= 3 ? "amber" : hi <= 8 ? "red" : "black";

  return (
    <div className="space-y-2">
      {/* These KPIs are the risk-engine rollup of the live ingest cycle —
          LIVE-derived. One strip-level badge keeps the credibility rule intact
          without crowding six glanceable tiles. The Affected-Population tile
          carries its own REFERENCE badge: the count of stressed provinces is
          live, but the population base it sums is the static NSO/UNFPA estimate. */}
      <div className="flex items-center gap-2">
        <ProvenanceBadge value="LIVE" />
        <span className="text-[11px] md:text-[10px] text-text-muted">
          Derived from this cycle&apos;s national rollup
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <MetricTile
        icon={<Activity size={12} />}
        label="ENSO Phase"
        value={<span className="text-lg">{PHASE_SHORT[national.enso_phase]}</span>}
        tone={PHASE_TONE[national.enso_phase]}
        hint={PHASE_HINT[national.enso_phase]}
      />
      <MetricTile
        icon={<AlertTriangle size={12} />}
        label="National Alert"
        value={national.alert_level}
        tone={ALERT_TONE[national.alert_level]}
        hint={ALERT_HINT[national.alert_level]}
      />
      <MetricTile
        icon={<Gauge size={12} />}
        label="National Risk"
        value={national.national_risk_rating.toUpperCase()}
        tone={RISK_TONE[national.national_risk_rating]}
        hint={RISK_HINT[national.national_risk_rating]}
      />
      <MetricTile
        icon={<Users size={12} />}
        label="Affected Population (est.)"
        value={affectedLabel}
        tone="sky"
        hint={
          <span className="inline-flex flex-wrap items-center gap-1">
            <ProvenanceBadge value="REFERENCE" />
            <span>
              Σ population of high/critical provinces · NSO/UNFPA 2021 estimate
            </span>
          </span>
        }
      />
      <MetricTile
        icon={<MapPin size={12} />}
        label="High-Risk Provinces"
        value={String(national.high_risk_province_count)}
        tone={provinceTone}
        hint={`Of the ${FOCUS_COUNT} focus provinces in this prototype`}
      />
        <MetricTile
          icon={<CalendarRange size={12} />}
          label="Forecast Period"
          value={<span className="text-lg">{national.forecast_period}</span>}
          tone="accent"
        />
      </div>
    </div>
  );
}
