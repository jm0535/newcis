import { type HTMLAttributes, type ReactNode } from "react";

type CardVariant = "default" | "muted" | "elevated";

const VARIANT_CLASS: Record<CardVariant, string> = {
  default: "bg-surface-1 border border-border-subtle",
  muted: "bg-surface-2 border border-border-subtle",
  elevated: "bg-surface-1 border border-border-subtle shadow-[var(--elevation-2)]",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
}

const PADDING_CLASS = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export function Card({
  variant = "default",
  padding = "md",
  interactive = false,
  className = "",
  ...rest
}: CardProps) {
  return (
    <div
      className={`rounded-lg ${VARIANT_CLASS[variant]} ${PADDING_CLASS[padding]} ${
        interactive ? "transition-colors hover:bg-surface-2 hover:border-border-default" : ""
      } ${className}`}
      {...rest}
    />
  );
}

export function CardHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-start justify-between gap-3 mb-3 ${className}`}>{children}</div>
  );
}

export function CardTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={`text-sm font-semibold text-text-1 ${className}`}>{children}</h3>
  );
}

export function CardDescription({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-xs text-text-muted leading-snug ${className}`}>{children}</p>
  );
}
