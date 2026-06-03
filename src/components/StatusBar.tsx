// Persistent status bar — always visible. Shows the national alert traffic-light,
// ENSO phase, last-ingest timestamp, and which sources succeeded this cycle.
import type { LastRun, NationalStatus } from "@/lib/types";
import { ALERT_BG_CLASS, fmtDateTime } from "@/lib/ui";
import { ThemeToggle } from "./ThemeToggle";

const ENSO_LABEL: Record<NationalStatus["enso_phase"], string> = {
  neutral: "ENSO Neutral",
  el_nino_watch: "El Niño Watch",
  el_nino_alert: "El Niño Alert",
  la_nina_watch: "La Niña Watch",
  la_nina_alert: "La Niña Alert",
};

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

  return (
    <div className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-20">
      <div className="px-6 py-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        <span
          className={`inline-flex items-center gap-2 px-2.5 py-1 rounded font-semibold uppercase tracking-wider border ${ALERT_BG_CLASS[alert]}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {alert}
        </span>
        <span className="text-zinc-300 font-medium">{phase}</span>
        <span className="text-zinc-500">
          Forecast period:{" "}
          <span className="text-zinc-300">{national?.forecast_period ?? "—"}</span>
        </span>
        <span className="ml-auto text-zinc-500">
          Data updated{" "}
          <span className="text-zinc-300 font-mono">
            {fmtDateTime(lastRun?.finished_at ?? national?.updated_at)}
          </span>
        </span>
        {sourceEntries.length > 0 && (
          <span className="flex items-center gap-2">
            {sourceEntries.map(([k, ok]) => (
              <span
                key={k}
                title={k}
                className={`w-2 h-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-500"}`}
              />
            ))}
            <span className="text-zinc-500">
              {sourceEntries.filter(([, ok]) => ok).length}/{sourceEntries.length} sources
            </span>
          </span>
        )}
        <ThemeToggle />
      </div>
    </div>
  );
}
