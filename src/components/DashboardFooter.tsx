// Shared footer for the five operating-picture pages (dashboard, climate,
// forecast, sectors, operations). Single source of truth so the "last ingest /
// auto-refresh / powered-by" row can never drift between pages. The landing page
// at "/" has its own richer footer (data partners) and does not use this.
import type { LastRun } from "@/lib/types";
import { fmtDateTime } from "@/lib/ui";
import { AUTO_REFRESH_LABEL } from "./AutoRefresh";

export function DashboardFooter({ lastRun }: { lastRun: LastRun | null }) {
  return (
    <footer className="border-t border-border-subtle px-4 md:px-6 py-3 text-[11px] text-text-muted flex flex-wrap justify-between gap-2">
      <span>
        Last ingest{" "}
        <span className="text-text-2" data-numeric>
          {fmtDateTime(lastRun?.finished_at)}
        </span>
        {lastRun?.notes && (
          <span className="ml-2 text-text-disabled">· {lastRun.notes}</span>
        )}
      </span>
      <span>Auto-refreshes {AUTO_REFRESH_LABEL}</span>
      <span>
        Powered by{" "}
        <a
          href="https://www.in4metrix.dev"
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:underline"
        >
          in4metrix
        </a>
      </span>
    </footer>
  );
}
