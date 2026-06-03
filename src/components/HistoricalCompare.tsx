// Historical comparison strip: how does the current ONI stack up against the
// reference El Niño / La Niña events PNG actually lived through?
// Seeded peak values; provenance reads DEMO because we're not pulling NOAA archive yet.
import type { Indicator } from "@/lib/types";
import { ALERT_COLOUR } from "@/lib/ui";
import { classifyIndicator } from "@/lib/risk-engine";
import type { RiskThreshold } from "@/lib/types";

const EVENTS: { label: string; oni: number; note: string }[] = [
  { label: "1997–98", oni: 2.4, note: "Super El Niño · PNG severe drought + frost" },
  { label: "2015–16", oni: 2.6, note: "Super El Niño · highlands food crisis" },
  { label: "2023–24", oni: 2.0, note: "Strong El Niño · CDEM activation" },
];

export function HistoricalCompare({
  oni,
  threshold,
}: {
  oni: Indicator | undefined;
  threshold: RiskThreshold | undefined;
}) {
  const current = oni?.value ?? null;
  const items = [
    ...EVENTS,
    { label: "Current", oni: current ?? 0, note: oni?.label ?? "ONI live reading" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((e) => {
        const isCurrent = e.label === "Current";
        const level = classifyIndicator(e.oni, threshold);
        return (
          <div
            key={e.label}
            className={`rounded-lg border p-3 ${
              isCurrent
                ? "border-emerald-500/60 bg-emerald-500/5"
                : "border-zinc-800 bg-zinc-900/30"
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">{e.label}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">
                {current === null && isCurrent ? "—" : e.oni.toFixed(2)}
              </span>
              <span
                className="text-[10px] uppercase font-semibold tracking-wider"
                style={{ color: ALERT_COLOUR[level] }}
              >
                {level}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-zinc-500 leading-snug">{e.note}</div>
          </div>
        );
      })}
    </div>
  );
}
