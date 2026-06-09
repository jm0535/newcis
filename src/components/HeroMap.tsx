"use client";

// HeroMap — the landing-page hero's living backdrop. A deliberately STRIPPED,
// NON-interactive cousin of HeatMap: same /public/provinces.geojson, same
// worst-risk tint per focus province, but no controls, no pointer interaction
// (the page scrolls over it). It exists to prove — in the first viewport — that
// NEWCIS renders the REAL national picture, not a stock photo.
//
// Instead of an aimless rotation, it runs a CINEMATIC AUTO-TOUR: an establishing
// shot of all of PNG, then a slow fly between a few high-signal real stops —
// the worst-risk focus province, an active volcano, a recent major disaster —
// zooming in and popping a label card at each, then looping. Every stop is drawn
// from the same real data the dashboard uses (sector_risk.json + hazards.json),
// and hazard stops are badged REFERENCE, never LIVE.
//
// All stops are offset to the RIGHT half of the frame so the zoomed province
// never collides with the hero's left-aligned headline — and so PNG fills the
// space that used to be empty. Reduced-motion users get a single static shot.
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RiskLevel, SectorRisk } from "@/lib/types";
import { RISK_COLOUR } from "@/lib/ui";

const RISK_RANK: Record<RiskLevel, number> = { low: 0, med: 1, high: 2, critical: 3 };

function worstByProvince(sectorRisk: SectorRisk[]): Record<string, RiskLevel> {
  const out: Record<string, RiskLevel> = {};
  for (const r of sectorRisk) {
    const cur = out[r.province_code];
    if (!cur || RISK_RANK[r.level] > RISK_RANK[cur]) out[r.province_code] = r.level;
  }
  return out;
}

// One stop on the tour. `label` (when present) renders a small card at the point.
interface Stop {
  center: [number, number];
  zoom: number;
  label?: {
    title: string;
    sub: string;
    tag: string;
    tone: "risk-critical" | "risk-high" | "volcano" | "tsunami" | "landslide";
    glyph?: string;
  };
  dwell: number; // ms to hold here before flying on
}

// Per-tone colour + glyph, kept in step with HeatMap's hazard vocabulary so a
// 🌋/🌊/⚠️ on the landing tour reads the same as on the dashboard map. Risk tones
// borrow the traffic-light palette; hazard tones their hazard hue.
const TONE_CSS: Record<NonNullable<Stop["label"]>["tone"], { fg: string; dot: string }> = {
  "risk-critical": { fg: "#f87171", dot: "#334155" },
  "risk-high": { fg: "#fb7185", dot: "#f43f5e" },
  volcano: { fg: "#fb7185", dot: "#f43f5e" },
  tsunami: { fg: "#38bdf8", dot: "#38bdf8" },
  landslide: { fg: "#fbbf24", dot: "#fbbf24" },
};

// Curated tour — every coordinate/label from real data (see hazards.json &
// sector_risk.json). Gulf is the worst focus province (critical). The three
// hazard stops showcase each toggleable dashboard layer: an active submarine
// VOLCANO (Titan Ridge, Manus), the historic 1998 Sissano TSUNAMI (the deadliest
// in PNG record), and the 2024 Yambali LANDSLIDE. Hazard stops are REFERENCE.
const TOUR: Stop[] = [
  // Establishing shot — the whole country.
  { center: [147.0, -6.3], zoom: 4.6, dwell: 3200 },
  {
    center: [144.82, -7.65],
    zoom: 6.2,
    label: { title: "Gulf", sub: "Worst-risk focus province", tag: "CRITICAL", tone: "risk-critical" },
    dwell: 4200,
  },
  {
    center: [147.78, -3.03],
    zoom: 6.6,
    label: {
      title: "Titan Ridge",
      sub: "Active submarine volcano · Manus",
      tag: "REFERENCE",
      tone: "volcano",
      glyph: "🌋",
    },
    dwell: 4400,
  },
  {
    center: [142.04, -3.02],
    zoom: 6.8,
    label: {
      title: "Sissano tsunami",
      sub: "1998 · Sandaun · ~2,200 lost",
      tag: "REFERENCE",
      tone: "tsunami",
      glyph: "🌊",
    },
    dwell: 4400,
  },
  {
    center: [143.62, -5.28],
    zoom: 6.6,
    label: {
      title: "Yambali landslide",
      sub: "2024 · Enga · catastrophic",
      tag: "REFERENCE",
      tone: "landslide",
      glyph: "⚠️",
    },
    dwell: 4400,
  },
];

// Shift the flyTo target left in screen space so the zoomed point lands in the
// RIGHT portion of the hero (clear of the headline). Positive x ⇒ target moves
// toward the right edge. Scaled to container width.
function rightOffset(width: number): [number, number] {
  return [Math.min(width * 0.22, 320), 0];
}

function buildLabelHTML(l: NonNullable<Stop["label"]>): string {
  const t = TONE_CSS[l.tone];
  // Hazard stops show their emoji glyph (🌋/🌊/⚠️) as the badge; risk stops a
  // coloured dot. Either way the title row carries a clear leading marker.
  const marker = l.glyph
    ? `<span style="font-size:13px;line-height:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.7));">${l.glyph}</span>`
    : `<span style="width:7px;height:7px;border-radius:9999px;background:${t.dot};"></span>`;
  return `<div style="font-family:system-ui;font-size:12px;color:#f4f4f5;background:rgba(9,9,11,0.92);border:1px solid #3f3f46;border-radius:6px;padding:8px 11px;box-shadow:0 8px 24px rgba(0,0,0,0.5);min-width:150px;">
      <div style="display:flex;align-items:center;gap:6px;font-weight:600;">
        ${marker}${l.title}
      </div>
      <div style="margin-top:3px;opacity:0.75;font-size:11px;">${l.sub}</div>
      <div style="margin-top:6px;font-size:9px;font-weight:700;letter-spacing:0.08em;color:${t.fg};">${l.tag}</div>
    </div>`;
}

export function HeroMap({ sectorRisk }: { sectorRisk: SectorRisk[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const isLight = document.documentElement.classList.contains("light");
    const bgColour = isLight ? "#fafafa" : "#09090b";

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: "bg", type: "background", paint: { "background-color": bgColour } }],
      },
      center: TOUR[0].center,
      zoom: TOUR[0].zoom,
      // Non-interactive: the page owns the pointer, the map is pure backdrop.
      interactive: false,
      attributionControl: false,
    });
    mapRef.current = map;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    map.on("load", async () => {
      try {
        const res = await fetch("/provinces.geojson");
        const geojson = await res.json();
        const worst = worstByProvince(sectorRisk);

        for (const f of geojson.features) {
          const code: string = f.properties.code;
          const level = worst[code];
          f.properties.risk_colour = level ? RISK_COLOUR[level] : isLight ? "#d4d4d8" : "#27272a";
        }

        if (mapRef.current !== map) return;
        map.addSource("provinces", { type: "geojson", data: geojson });
        map.addLayer({
          id: "provinces-fill",
          type: "fill",
          source: "provinces",
          paint: {
            "fill-color": ["get", "risk_colour"],
            "fill-opacity": ["case", ["get", "is_focus"], 0.78, 0.22],
          },
        });
        map.addLayer({
          id: "provinces-line",
          type: "line",
          source: "provinces",
          paint: {
            "line-color": ["case", ["get", "is_focus"], "#fafafa", "#3f3f46"],
            "line-width": ["case", ["get", "is_focus"], 1, 0.4],
          },
        });

        // The container may not have its final height at init (the hero's
        // min-height resolves a tick after mount); force MapLibre to re-measure
        // so the canvas fills the whole hero instead of locking to its default.
        requestAnimationFrame(() => mapRef.current === map && map.resize());
      } catch {
        // A failed geojson fetch leaves the flat background — the hero's overlay
        // copy still reads, so the page degrades gracefully.
      }

      // Reduced motion (or a single-stop tour): hold a static, well-framed shot
      // offset to the right; no fly loop, no label churn.
      if (reduce || TOUR.length < 2) {
        const w = containerRef.current?.clientWidth ?? map.getCanvas().width;
        map.easeTo({ center: TOUR[1]?.center ?? TOUR[0].center, zoom: 5.4, offset: rightOffset(w), duration: 0 });
        return;
      }

      // Cinematic auto-tour. flyTo each stop, dwell, then advance — looping.
      let i = 0;
      const go = () => {
        if (mapRef.current !== map) return;
        const stop = TOUR[i];
        const w = containerRef.current?.clientWidth ?? 1000;

        // Clear the previous label before moving.
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }

        map.flyTo({
          center: stop.center,
          zoom: stop.zoom,
          offset: rightOffset(w),
          speed: 0.5, // gentle
          curve: 1.5,
          essential: true,
        });

        // Drop the label once we arrive, if this stop has one.
        const showLabel = () => {
          if (mapRef.current !== map || !stop.label) return;
          popupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 14,
            // newcis-popup kills the default white wrapper; newcis-hero-popup
            // lifts the label above the hero's scrim gradients (which are later
            // DOM siblings and would otherwise paint over it).
            className: "newcis-popup newcis-hero-popup",
          })
            .setLngLat(stop.center)
            .setHTML(buildLabelHTML(stop.label))
            .addTo(map);
        };
        map.once("moveend", showLabel);

        // Schedule the next stop after the dwell.
        timerRef.current = setTimeout(() => {
          i = (i + 1) % TOUR.length;
          go();
        }, stop.dwell);
      };
      go();
    });

    // Keep the backdrop filling its box across viewport/orientation changes.
    const ro = new ResizeObserver(() => mapRef.current === map && map.resize());
    ro.observe(containerRef.current);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [sectorRisk]);

  // MapLibre's own stylesheet forces `.maplibregl-map { position: relative }`,
  // which beats a Tailwind `absolute` utility on the SAME element — so the
  // container can't be the absolutely-positioned fill layer (it would collapse
  // to height 0). An OUTER wrapper owns the `absolute inset-0` fill instead, and
  // the MapLibre container stretches to fill it at h/w 100%.
  return (
    <div aria-hidden className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
