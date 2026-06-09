// The credibility rule (CLAUDE.md §0): every data element on screen carries a
// LIVE, DEMO or REFERENCE badge. Never blur them.
//   LIVE      — pulled from a real API this cycle (accent, pulsing).
//   DEMO      — seeded placeholder, no clean public feed yet (muted).
//   REFERENCE — curated historical record (sky outline, static — a real but
//               point-in-time fact, distinct from both live and seeded).
import type { Provenance } from "@/lib/types";

const STYLE: Record<Provenance, { wrap: string; dot: string }> = {
  LIVE: {
    wrap: "bg-accent/15 text-accent border-accent/40",
    dot: "bg-accent animate-pulse",
  },
  DEMO: {
    wrap: "bg-surface-2 text-text-muted border-border-default",
    dot: "bg-text-muted",
  },
  REFERENCE: {
    wrap: "bg-status-sky/15 text-status-sky border-status-sky/40",
    dot: "bg-status-sky",
  },
};

export function ProvenanceBadge({ value }: { value: Provenance }) {
  const s = STYLE[value];
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-[0.08em] border ${s.wrap}`}
    >
      <span className={`w-1 h-1 rounded-full ${s.dot}`} />
      {value}
    </span>
  );
}
