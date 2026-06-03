// The credibility rule (CLAUDE.md §0): every data element on screen carries a
// LIVE or DEMO badge. Never blur the two.
import type { Provenance } from "@/lib/types";

export function ProvenanceBadge({ value }: { value: Provenance }) {
  const live = value === "LIVE";
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
        live
          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
          : "bg-zinc-500/15 text-zinc-300 border-zinc-500/40"
      }`}
    >
      <span
        className={`w-1 h-1 rounded-full ${live ? "bg-emerald-400 animate-pulse" : "bg-zinc-400"}`}
      />
      {value}
    </span>
  );
}
