import { type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md";

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    "bg-accent text-zinc-950 hover:bg-accent-hover border border-accent disabled:bg-surface-3 disabled:text-text-disabled disabled:border-border-default",
  secondary:
    "bg-surface-2 text-text-1 hover:bg-surface-3 border border-border-default disabled:text-text-disabled",
  ghost:
    "bg-transparent text-text-2 hover:bg-surface-2 hover:text-text-1 border border-transparent",
  destructive:
    "bg-status-red text-white hover:opacity-90 border border-status-red disabled:opacity-50",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "text-[11px] px-2 py-1 gap-1.5",
  md: "text-xs px-3 py-1.5 gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded font-medium uppercase tracking-[0.06em] transition-colors disabled:cursor-not-allowed ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
