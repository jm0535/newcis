// Persistent status bar — always visible. Shows the national alert traffic-light,
// ENSO phase, last-ingest timestamp, and which sources succeeded this cycle.
import type { LastRun, NationalStatus } from "@/lib/types";
import { fmtDateTime } from "@/lib/ui";
import { AutoRefresh } from "./AutoRefresh";
import { LiveClock } from "./LiveClock";
import { StatusPill } from "./ui";
import { ThemeToggle } from "./ThemeToggle";
import { sourceLabel } from "@/lib/sources";
import { Clock, RefreshCw } from "lucide-react";

const ENSO_LABEL: Record<NationalStatus["enso_phase"], string> = {
  neutral: "ENSO Neutral",
  el_nino_watch: "El Niño Watch",
  el_nino_alert: "El Niño Alert",
  la_nina_watch: "La Niña Watch",
  la_nina_alert: "La Niña Alert",
};

const ALERT_STATUS = {
  GREEN: "green",
  AMBER: "amber",
  RED: "red",
  BLACK: "black",
} as const;

export function StatusBar({
  national,
  lastRun,
}: {
  national: NationalStatus | null;
  lastRun: LastRun | null;
}) {
  const alert = national?.alert_level ?? "GREEN";
  const phase = national ? ENSO_LABEL[national.enso_phase] : "ENSO Neutral";
  const sources = lastRun?.sources_ok ?? {};
  const sourceEntries = Object.entries(sources);
  const sourcesOk = sourceEntries.filter(([, ok]) => ok).length;

  return (
    <div className="border-b border-border-subtle bg-[var(--surface-overlay)] backdrop-blur-md sticky top-0 z-20">
      <div className="px-4 md:px-6 py-2.5 flex flex-wrap items-center gap-x-4 md:gap-x-5 gap-y-2 text-xs">
        <StatusPill status={ALERT_STATUS[alert]} pulse={alert !== "GREEN"}>
          {alert}
        </StatusPill>
        <span className="text-text-2 font-medium">{phase}</span>
        <span className="text-text-muted">
          Forecast{" "}
          <span className="text-text-2">{national?.forecast_period ?? "—"}</span>
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-text-muted">
          <Clock size={12} />
          <LiveClock />
        </span>
        <span
          className="flex items-center gap-1.5 text-text-muted"
          title="When the data was last refreshed (Papua New Guinea time)"
        >
          <RefreshCw size={11} />
          <span className="hidden sm:inline">Updated</span>
          <span data-numeric className="text-text-2">
            {fmtDateTime(lastRun?.finished_at ?? national?.updated_at)}
          </span>
        </span>
        <AutoRefresh />
        {sourceEntries.length > 0 && (
          <span
            className="flex items-center gap-2"
            aria-label={`${sourcesOk} of ${sourceEntries.length} sources OK`}
          >
            {sourceEntries.map(([k, ok]) => (
              <span
                key={k}
                title={`${sourceLabel(k)} — ${ok ? "updated this cycle" : "no new data this cycle"}`}
                className={`w-2 h-2 rounded-full ${ok ? "bg-status-green" : "bg-status-red"}`}
              />
            ))}
            <span className="text-text-muted" data-numeric>
              {sourcesOk}/{sourceEntries.length}
            </span>
          </span>
        )}
        <ThemeToggle />
      </div>
    </div>
  );
}
