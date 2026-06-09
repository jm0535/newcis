"use client";

// HeroMap — the landing-page hero's living backdrop. A deliberately STRIPPED,
// NON-interactive cousin of HeatMap: same /public/provinces.geojson, same
// worst-risk tint per focus province, but no controls, no popups, no hazard
// markers, no basemap swap, and no pointer interaction (the page scrolls over
// it). It exists to prove — in the first viewport — that NEWCIS renders the real
// national picture, not a stock photo. A slow, gentle rotate gives it life
// without demanding attention. All interaction lives at /dashboard.
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

export function HeroMap({ sectorRisk }: { sectorRisk: SectorRisk[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const rafRef = useRef<number | null>(null);

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
      center: [144.5, -6.3],
      zoom: 4.5,
      // Non-interactive: the page owns the pointer, the map is pure backdrop.
      interactive: false,
      attributionControl: false,
    });
    mapRef.current = map;

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
      } catch {
        // A failed geojson fetch just leaves the flat background — the hero's
        // overlay copy still reads, so the page degrades gracefully.
      }

      // Slow, respectful drift. Honour prefers-reduced-motion: hold a static
      // bearing for anyone who's asked the system to stop moving things.
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduce) return;

      const start = performance.now();
      const spin = (now: number) => {
        if (mapRef.current !== map) return;
        // ~0.6°/s rotation — barely-there life, never distracting.
        map.setBearing(((now - start) / 1000) * 0.6);
        rafRef.current = requestAnimationFrame(spin);
      };
      rafRef.current = requestAnimationFrame(spin);
    });

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, [sectorRisk]);

  return <div ref={containerRef} aria-hidden className="absolute inset-0 h-full w-full" />;
}
