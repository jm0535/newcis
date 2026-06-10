// Animated data-partner marquee (devin.com-style): a continuous, edge-faded
// rail of branded partner chips that scrolls infinitely. Each chip is a
// self-drawn "logo" (acronym + domain glyph + data role) — NOT a copied agency
// logo, so there's no trademark/hot-linking concern.
//
// Mechanics: the track is rendered TWICE back-to-back and translated -50% over
// the loop, so the second copy seamlessly takes over as the first scrolls off —
// no visible jump. Pure CSS animation (keyframes in globals.css), so this stays
// a server component. prefers-reduced-motion pauses the scroll (handled in CSS)
// and the chips simply sit static, still fully readable.
import { PARTNERS } from "@/app/landing/constants";

export function PartnerMarquee() {
  // One render pass of all chips; we lay it down twice in the track for the loop.
  const chips = PARTNERS.map((p) => {
    const Glyph = p.glyph;
    return (
      <div
        key={p.name}
        className="group/chip mx-2 flex shrink-0 items-center gap-3 rounded-lg border border-border-subtle bg-surface-2/60 px-4 py-3 backdrop-blur transition-colors duration-200 hover:border-accent/50 hover:bg-surface-2"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-1 text-text-muted ring-1 ring-border-subtle transition-colors duration-200 group-hover/chip:text-accent group-hover/chip:ring-accent/40">
          <Glyph size={18} />
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-semibold leading-tight text-text-1 whitespace-nowrap">
            {p.name}
          </span>
          <span className="text-[10px] uppercase tracking-[0.08em] text-text-muted whitespace-nowrap">
            {p.role}
          </span>
        </span>
      </div>
    );
  });

  return (
    <div
      className="group relative overflow-hidden"
      // Symmetric edge fade so chips dissolve into the background at both rails.
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
    >
      {/* The animated track. Pauses on hover so a viewer can read a chip, and is
          frozen entirely under prefers-reduced-motion (see globals.css). */}
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:flex-wrap">
        <div className="flex shrink-0" aria-label="Data sources">
          {chips}
        </div>
        {/* Duplicate copy for the seamless loop — hidden from screen readers so
            the partner list isn't announced twice. */}
        <div className="flex shrink-0" aria-hidden>
          {chips}
        </div>
      </div>
    </div>
  );
}
