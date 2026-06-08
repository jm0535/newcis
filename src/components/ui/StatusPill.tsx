import { type ReactNode } from "react";

type Status = "green" | "amber" | "red" | "black" | "neutral";

const STATUS_CLASS: Record<Status, string> = {
  green: "bg-status-green/15 text-status-green border-status-green/40",
  amber: "bg-status-amber/15 text-status-amber border-status-amber/40",
  red: "bg-status-red/15 text-status-red border-status-red/50",
  // BLACK (emergency) is a DARK tier, so the faint-tint + coloured-text pattern
  // the other levels use would be dark-on-dark and illegible. Instead fill it
  // solid slate with light text and a bright outline — it reads as a solid
  // "beyond red" emergency chip on both dark and light surfaces.
  black: "bg-status-black text-white border-status-black ring-1 ring-white/25",
  neutral: "bg-surface-2 text-text-2 border-border-default",
};

const DOT_CLASS: Record<Status, string> = {
  green: "bg-status-green",
  amber: "bg-status-amber",
  red: "bg-status-red",
  // White dot — the pill is filled solid slate, so a slate dot would vanish.
  black: "bg-white",
  neutral: "bg-text-muted",
};

export interface StatusPillProps {
  status: Status;
  children: ReactNode;
  size?: "sm" | "md";
  pulse?: boolean;
}

export function StatusPill({ status, children, size = "md", pulse = false }: StatusPillProps) {
  const sizeClass = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2.5 py-1";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-[0.08em] ${STATUS_CLASS[status]} ${sizeClass}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${DOT_CLASS[status]} ${pulse ? "animate-pulse" : ""}`}
      />
      {children}
    </span>
  );
}
