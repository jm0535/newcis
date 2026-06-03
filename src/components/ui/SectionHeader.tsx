import { type ReactNode } from "react";

export interface SectionHeaderProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  eyebrow?: string;
}

export function SectionHeader({ title, description, action, eyebrow }: SectionHeaderProps) {
  return (
    <header className="flex items-end justify-between gap-4 mb-4">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[10px] uppercase tracking-[0.12em] text-accent font-semibold mb-1">
            {eyebrow}
          </div>
        )}
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-text-2">{title}</h2>
        {description && (
          <p className="text-xs text-text-muted mt-1 leading-snug max-w-prose">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
