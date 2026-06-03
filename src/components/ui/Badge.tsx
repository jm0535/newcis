import { type ReactNode } from "react";

type Variant = "default" | "accent" | "outline" | "subtle";

const VARIANT_CLASS: Record<Variant, string> = {
  default: "bg-surface-2 text-text-2 border border-border-default",
  accent: "bg-accent/15 text-accent border border-accent/40",
  outline: "bg-transparent text-text-2 border border-border-default",
  subtle: "bg-surface-2 text-text-muted border border-border-subtle",
};

export interface BadgeProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-[0.06em] ${VARIANT_CLASS[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
