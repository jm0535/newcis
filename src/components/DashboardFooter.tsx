// Shared footer for the five operating-picture pages (dashboard, climate,
// forecast, sectors, operations). Single source of truth so the "last ingest /
// auto-refresh / developed-by" row can never drift between pages. The landing
// page at "/" has its own richer footer (data sources) and does not use this.
//
// NOTE: the verbose per-source ingest log (`lastRun.notes`) is deliberately NOT
// shown here — it's a multi-line raw debug string. Its proper home is the
// "Ingest pipeline" card on the Operations page; the footer stays a one-line
// timestamp so it reads the same on every page.
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
      </span>
      <span>Auto-refreshes {AUTO_REFRESH_LABEL}</span>
      <span>
        Developed by{" "}
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
