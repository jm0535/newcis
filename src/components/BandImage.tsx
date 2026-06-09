"use client";

// BandImage — a full-bleed editorial photo backdrop for a landing-page section.
//
// Honesty contract: these photos are ILLUSTRATIVE, not live event imagery. The
// caller is expected to render a small "Illustrative" provenance note over the
// band so a reader never mistakes the scene for a reading from the current
// cycle (the NEWCIS credibility rule, extended to imagery).
//
// Graceful degradation: the image lives at /public/img/<src>. Until that file
// exists (or if it 404s / fails to decode) the band shows ONLY its gradient
// scrim — so the layout is intentional and complete today, and simply gains a
// photo the moment one is dropped into the slot, with zero code changes.
import { useState } from "react";

export interface BandImageProps {
  /** File under /public/img — e.g. "hero-ops.jpg". */
  src: string;
  alt: string;
  /**
   * Gradient scrim painted OVER the photo (and shown alone as the fallback).
   * Tailwind classes — defaults to a bottom-weighted dark scrim that keeps
   * overlaid text legible on most photography.
   */
  scrimClassName?: string;
  className?: string;
  /**
   * Extra classes on the <img> itself — e.g. "opacity-30 saturate-[0.6]" to dim
   * and mute a busy photo so it reads as quiet texture behind foreground text
   * rather than competing with it.
   */
  imgClassName?: string;
}

export function BandImage({
  src,
  alt,
  scrimClassName = "bg-gradient-to-t from-surface-0 via-surface-0/70 to-surface-0/30",
  className = "",
  imgClassName = "",
}: BandImageProps) {
  const [ok, setOk] = useState(true);

  return (
    <div aria-hidden className={`absolute inset-0 overflow-hidden ${className}`}>
      {ok && (
        // Plain <img> (not next/image): these are decorative band backdrops, and
        // a missing file must fail softly to the scrim via onError — next/image
        // would throw on an absent asset and we want a silent fallback instead.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/img/${src}`}
          alt={alt}
          onError={() => setOk(false)}
          className={`h-full w-full object-cover object-center select-none pointer-events-none ${imgClassName}`}
          draggable={false}
        />
      )}
      <div className={`absolute inset-0 ${scrimClassName}`} />
    </div>
  );
}
