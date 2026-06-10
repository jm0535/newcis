import { type ReactNode } from "react";
import { Card } from "./Card";

type Tone = "default" | "green" | "amber" | "red" | "black";

const TONE_CLASS: Record<Tone, string> = {
  default: "",
  green: "border-status-green/50 bg-[color-mix(in_oklab,var(--status-green)_10%,var(--surface-1))]",
  amber: "border-status-amber/50 bg-[color-mix(in_oklab,var(--status-amber)_10%,var(--surface-1))]",
  red: "border-status-red/50 bg-[color-mix(in_oklab,var(--status-red)_12%,var(--surface-1))]",
  black: "border-status-black/60 bg-[color-mix(in_oklab,var(--status-black)_20%,var(--surface-1))]",
};

const VALUE_TONE_CLASS: Record<Tone, string> = {
  default: "text-text-1",
  green: "text-status-green",
  amber: "text-status-amber",
  red: "text-status-red",
  // BLACK is a dark tier — colouring the value slate-on-slate would be unreadable
  // over the dark-tinted card, so the value keeps the high-contrast primary text.
  black: "text-text-1",
};

export interface MetricTileProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}

export function MetricTile({ label, value, hint, tone = "default", icon }: MetricTileProps) {
  return (
    <Card padding="md" className={`flex flex-col gap-2 min-h-[6.5rem] ${TONE_CLASS[tone]}`}>
      <div className="flex items-center gap-2 text-[11px] md:text-[10px] uppercase tracking-[0.08em] text-text-muted font-medium">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={`text-2xl font-semibold leading-none numeric ${VALUE_TONE_CLASS[tone]}`}
        data-numeric
      >
        {value}
      </div>
      {hint && <div className="text-xs text-text-muted leading-snug mt-auto">{hint}</div>}
    </Card>
  );
}
