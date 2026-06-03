import { type ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4 rounded-lg border border-dashed border-border-default bg-surface-2/40">
      {icon && <div className="text-text-muted mb-3">{icon}</div>}
      <div className="text-sm font-semibold text-text-2">{title}</div>
      {description && (
        <div className="text-xs text-text-muted mt-1 max-w-xs leading-snug">{description}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
