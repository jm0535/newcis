// Page-1 header KPI cards: ENSO phase, national alert level, risk rating,
// affected population estimate, # high-risk provinces, forecast period.
// Glanceable from across an ops centre — large numerals, single colour cue per card.
import type { NationalStatus } from "@/lib/types";
import { ALERT_BG_CLASS, RISK_BG_CLASS } from "@/lib/ui";

const PHASE_SHORT: Record<NationalStatus["enso_phase"], string> = {
  neutral: "Neutral",
  el_nino_watch: "El Niño Watch",
  el_nino_alert: "El Niño Alert",
  la_nina_watch: "La Niña Watch",
  la_nina_alert: "La Niña Alert",
};

function Card({
  label,
  value,
  className = "",
  sub,
}: {
  label: string;
  value: string;
  className?: string;
  sub?: string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${className}`}>
      <div className="text-[10px] uppercase tracking-[0.15em] opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-semibold leading-tight">{value}</div>
      {sub && <div className="mt-1 text-xs opacity-75">{sub}</div>}
    </div>
  );
}

export function KpiStrip({ national }: { national: NationalStatus | null }) {
  if (!national) {
    return (
      <div className="text-sm text-zinc-500 border border-dashed border-zinc-700 rounded-lg p-6">
        No national status available — ingest has not run yet.
      </div>
    );
  }

  const affected = national.affected_population_est;
  const affectedLabel = affected > 0 ? affected.toLocaleString() : "—";

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <Card
        label="ENSO Phase"
        value={PHASE_SHORT[national.enso_phase]}
        className="bg-zinc-900/60 border-zinc-800 text-zinc-100"
      />
      <Card
        label="National Alert"
        value={national.alert_level}
        className={ALERT_BG_CLASS[national.alert_level]}
      />
      <Card
        label="National Risk"
        value={national.national_risk_rating.toUpperCase()}
        className={RISK_BG_CLASS[national.national_risk_rating]}
      />
      <Card
        label="Affected Population (est.)"
        value={affectedLabel}
        sub="Phase 3 risk-engine extension"
        className="bg-zinc-900/60 border-zinc-800 text-zinc-100"
      />
      <Card
        label="High-Risk Provinces"
        value={String(national.high_risk_province_count)}
        sub="Focus set (Enga, WH, SH, Gulf)"
        className="bg-zinc-900/60 border-zinc-800 text-zinc-100"
      />
      <Card
        label="Forecast Period"
        value={national.forecast_period}
        className="bg-zinc-900/60 border-zinc-800 text-zinc-100"
      />
    </div>
  );
}
