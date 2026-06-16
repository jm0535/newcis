/**
 * WefCover — a DESIGNED cover banner for a WEF insight tile, used in the slot
 * where a publisher cover image would sit.
 *
 * Deliberately NOT the WEF page's own og:image. NEWCIS does not hold a licence to
 * embed WEF's copyrighted photography, and WEF's site bot-blocks fetchers anyway.
 * Instead this renders an original, on-brand banner: a deterministic gradient
 * seeded from the tile id (so each card reads distinct and stable across renders),
 * the WEF wordmark, the source label, and the sector tag. Zero external media,
 * zero copyright exposure — a cover that evokes a snapshot without reproducing one.
 */
import type { WefInsight } from "@/lib/wef";

// Two-stop gradient pairs (semantic-token friendly, deep editorial blues/teals
// matching WEF's own palette family). Picked by a stable hash of the tile id so a
// given tile always gets the same cover.
const GRADIENTS: [string, string][] = [
  ["#0b2a4a", "#10455f"],
  ["#11324a", "#1d5b63"],
  ["#142a52", "#2a4a7a"],
  ["#0e3340", "#185158"],
  ["#1a2b4d", "#33507e"],
  ["#0c2740", "#16424f"],
];

function hashIndex(seed: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % mod;
}

export function WefCover({
  insight,
  className = "",
}: {
  insight: WefInsight;
  className?: string;
}) {
  const [from, to] = GRADIENTS[hashIndex(insight.id, GRADIENTS.length)];

  return (
    <div
      className={`relative overflow-hidden rounded-md ${className}`}
      style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
      aria-hidden
    >
      {/* faint topographic-style line pattern, evokes a map/intel snapshot */}
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.5) 0, transparent 40%), repeating-linear-gradient(115deg, rgba(255,255,255,0.18) 0 1px, transparent 1px 14px)",
        }}
      />
      <div className="relative flex h-full flex-col justify-between p-3">
        <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/80">
          World Economic Forum
        </span>
        <div className="flex items-end justify-between gap-2">
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/70">
            {insight.source}
          </span>
          {insight.sector && (
            <span className="rounded-sm bg-white/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-white/90">
              {insight.sector}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
