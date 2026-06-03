// Historical comparison strip: how does the current ONI stack up against the
// reference El Niño / La Niña events PNG actually lived through?
import type { Indicator } from "@/lib/types";
import { classifyIndicator } from "@/lib/risk-engine";
import type { RiskThreshold } from "@/lib/types";
import { Card, StatusPill } from "./ui";

const EVENTS: { label: string; oni: number; note: string }[] = [
  { label: "1997–98", oni: 2.4, note: "Super El Niño · PNG severe drought + frost" },
  { label: "2015–16", oni: 2.6, note: "Super El Niño · highlands food crisis" },
  { label: "2023–24", oni: 2.0, note: "Strong El Niño · CDEM activation" },
];

const ALERT_STATUS = {
  GREEN: "green",
  AMBER: "amber",
  RED: "red",
  BLACK: "black",
} as const;

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
          <Card
            key={e.label}
            variant={isCurrent ? "elevated" : "muted"}
            padding="sm"
            className={isCurrent ? "border-accent/50 ring-1 ring-accent/30" : ""}
          >
            <div className="text-[10px] uppercase tracking-[0.08em] text-text-muted font-semibold">
              {e.label}
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-semibold text-text-1" data-numeric>
                {current === null && isCurrent ? "—" : e.oni.toFixed(2)}
              </span>
              <StatusPill status={ALERT_STATUS[level]} size="sm">
                {level}
              </StatusPill>
            </div>
            <div className="mt-2 text-[11px] text-text-muted leading-snug">{e.note}</div>
          </Card>
        );
      })}
    </div>
  );
}
