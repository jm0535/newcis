// The one sentence the Prime Minister reads first. Synthesises the national
// status into plain English — "what's happening, how bad, what to do" — so a
// non-technical leader gets the bottom line before scanning any tile or matrix.
import type { NationalStatus } from "@/lib/types";
import { StatusPill } from "./ui";
import { AlertTriangle } from "lucide-react";

const ALERT_STATUS = { GREEN: "green", AMBER: "amber", RED: "red", BLACK: "black" } as const;

const PHASE_PLAIN: Record<NationalStatus["enso_phase"], string> = {
  neutral: "The Pacific is in a neutral state (no El Niño or La Niña)",
  el_nino_watch: "An El Niño is building (drought/frost risk rising)",
  el_nino_alert: "An El Niño is underway (highland drought & frost likely)",
  la_nina_watch: "A La Niña is building (flood risk rising)",
  la_nina_alert: "A La Niña is underway (heavy rain & flooding likely)",
};

const ACTION: Record<NationalStatus["alert_level"], string> = {
  GREEN: "Maintain routine monitoring.",
  AMBER: "Brief sector leads and verify cluster readiness.",
  RED: "Pre-position water and health supplies and issue advisories to the focus provinces.",
  BLACK: "Activate the National Emergency Operations Centre now.",
};

export function ExecutiveHeadline({ national }: { national: NationalStatus | null }) {
  if (!national) return null;

  const level = national.alert_level;
  const risk = national.national_risk_rating.toUpperCase();
  const provinces = national.high_risk_province_count;

  const sentence =
    `${PHASE_PLAIN[national.enso_phase]}, but the national alert is ` +
    `${level} and overall risk is ${risk}` +
    (provinces > 0
      ? ` — ${provinces} of the 4 focus provinces are stressed across multiple sectors.`
      : ".");

  return (
    <div className="rounded-lg border border-border-default bg-surface-1 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-2 shrink-0">
        <AlertTriangle size={16} className="text-status-red" />
        <span className="text-[10px] uppercase tracking-[0.12em] text-text-muted font-semibold">
          Bottom line
        </span>
        <StatusPill status={ALERT_STATUS[level]} size="sm" pulse={level === "RED" || level === "BLACK"}>
          {level}
        </StatusPill>
      </div>
      <p className="text-sm text-text-1 leading-relaxed">
        {sentence}{" "}
        <span className="text-text-2 font-medium">{ACTION[level]}</span>
      </p>
    </div>
  );
}
