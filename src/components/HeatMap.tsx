"use client";

// Provincial heat map. All 22 provinces drawn from /public/provinces.geojson;
// only the 4 focus provinces are coloured by their *worst* sector risk (the
// signal an executive cares about: which provinces should I look at first?).
// Non-focus provinces are greyed — explicit reminder this PoC is a slice.
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

export function HeatMap({ sectorRisk }: { sectorRisk: SectorRisk[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      // Raster-tile-free open style: just a flat backdrop so the polygons read clearly.
      // Avoids needing a tile-server key for the PoC.
      style: {
        version: 8,
        sources: {},
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#09090b" } },
        ],
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      },
      center: [144.5, -6.3], // central PNG
      zoom: 4.6,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on("load", async () => {
      const res = await fetch("/provinces.geojson");
      const geojson = await res.json();
      const worst = worstByProvince(sectorRisk);

      // Bake risk colour + focus flag onto each feature so MapLibre can drive paint
      // expressions directly — no per-render JS recolour.
      for (const f of geojson.features) {
        const code: string = f.properties.code;
        const level = worst[code];
        f.properties.risk_colour = level ? RISK_COLOUR[level] : "#27272a"; // zinc-800
        f.properties.risk_level = level ?? "none";
      }

      map.addSource("provinces", { type: "geojson", data: geojson });

      map.addLayer({
        id: "provinces-fill",
        type: "fill",
        source: "provinces",
        paint: {
          "fill-color": ["get", "risk_colour"],
          "fill-opacity": ["case", ["get", "is_focus"], 0.7, 0.25],
        },
      });

      map.addLayer({
        id: "provinces-line",
        type: "line",
        source: "provinces",
        paint: {
          "line-color": ["case", ["get", "is_focus"], "#fafafa", "#3f3f46"],
          "line-width": ["case", ["get", "is_focus"], 1.2, 0.5],
        },
      });

      map.on("click", "provinces-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { name: string; code: string; risk_level: string; is_focus: boolean };
        new maplibregl.Popup({ closeButton: false, className: "newcis-popup" })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family: system-ui; font-size: 12px; color: #f4f4f5;">
               <div style="font-weight: 600;">${p.name}</div>
               <div style="opacity: 0.7;">${p.code}</div>
               <div style="margin-top: 4px;">${p.is_focus ? `Risk: <b>${p.risk_level.toUpperCase()}</b>` : "Non-focus (not scored in PoC)"}</div>
             </div>`,
          )
          .addTo(map);
      });

      map.on("mouseenter", "provinces-fill", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "provinces-fill", () => (map.getCanvas().style.cursor = ""));
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [sectorRisk]);

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full h-[440px] rounded-lg border border-zinc-800 overflow-hidden" />
      <div className="absolute bottom-3 left-3 bg-zinc-950/85 border border-zinc-800 rounded px-2 py-1.5 text-[10px] uppercase tracking-wider text-zinc-400 flex items-center gap-3">
        {(["low", "med", "high", "critical"] as RiskLevel[]).map((lv) => (
          <span key={lv} className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ background: RISK_COLOUR[lv] }} />
            {lv}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 text-zinc-500">
          <span className="w-2 h-2 rounded-sm bg-zinc-700" />
          non-focus
        </span>
      </div>
    </div>
  );
}
