"use client";

// Provincial heat map. All 22 provinces drawn from /public/provinces.geojson;
// only the focus provinces (is_focus) are coloured by their *worst* sector risk (the
// signal an executive cares about: which provinces should I look at first?).
// Non-focus provinces are greyed — explicit reminder this PoC is a slice.
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RiskLevel, SectorRisk } from "@/lib/types";
import { RISK_COLOUR } from "@/lib/ui";

// A curated historical-hazard event at its REAL (hand-geocoded) coordinates, from
// /public/hazards.json (parsed each ingest from the /data CSVs). Three kinds —
// volcanoes, tsunamis, major disasters (landslides, cyclones, quakes, drought) —
// each rendered as its own toggleable map layer. Provenance is REFERENCE (curated
// record), never LIVE.
type HazardKind = "volcano" | "tsunami" | "disaster";

interface HazardEvent {
  kind: HazardKind;
  name: string;
  province: string;
  location: string;
  date: string;
  year: number | null;
  details: string;
  lon: number;
  lat: number;
}

// Per-kind marker presentation: emoji glyph, accent colour, and human label.
const HAZARD_STYLE: Record<HazardKind, { glyph: string; colour: string; label: string }> = {
  volcano: { glyph: "🌋", colour: "#f43f5e", label: "Volcanoes" },
  tsunami: { glyph: "🌊", colour: "#38bdf8", label: "Tsunamis" },
  disaster: { glyph: "⚠️", colour: "#fbbf24", label: "Landslides / cyclones" },
};

const HAZARD_KINDS: HazardKind[] = ["volcano", "tsunami", "disaster"];

const RISK_RANK: Record<RiskLevel, number> = { low: 0, med: 1, high: 2, critical: 3 };

type Basemap = "flat" | "osm" | "opentopo" | "satellite" | "esri-vector";

// Keyless XYZ raster sources. OSM + OpenTopo are community tile servers (fair-use
// caps but fine for a PoC). Esri World Imagery is the standard keyless satellite.
// `esri-vector` is special: it's an ArcGIS VectorTileServer style (not a raster
// XYZ source), loaded via its Public-tier, CORS-enabled root.json — see
// docs/living-atlas.md. Cosmetic only; never a LIVE data badge.
const BASEMAPS: Record<Basemap, { label: string; tiles: string[]; attribution: string } | null> = {
  flat: null,
  osm: {
    label: "OSM",
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: "© OpenStreetMap",
  },
  opentopo: {
    label: "Topo",
    tiles: ["https://a.tile.opentopomap.org/{z}/{x}/{y}.png"],
    attribution: "© OpenTopoMap (CC-BY-SA)",
  },
  satellite: {
    label: "Satellite",
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    attribution: "Esri World Imagery",
  },
  "esri-vector": {
    label: "Esri Vector",
    // Public-tier ArcGIS VectorTileServer — keyless, CORS *. Verified in docs/living-atlas.md.
    tiles: [],
    attribution: "Esri World Basemap (Public)",
  },
};

const ESRI_VECTOR_STYLE_URL =
  "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/resources/styles/root.json";

// IDs of the basemap layers/sources we inject for the Esri vector style, so the
// swap effect can cleanly tear them down before applying a different basemap.
const ESRI_SOURCE_PREFIX = "esri-bm-src";
const ESRI_LAYER_PREFIX = "esri-bm-";

function worstByProvince(sectorRisk: SectorRisk[]): Record<string, RiskLevel> {
  const out: Record<string, RiskLevel> = {};
  for (const r of sectorRisk) {
    const cur = out[r.province_code];
    if (!cur || RISK_RANK[r.level] > RISK_RANK[cur]) out[r.province_code] = r.level;
  }
  return out;
}

// Escape free-text fields before they go into a popup's innerHTML.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Build one DOM marker + popup for a curated hazard event. Volcanoes within the
// active window (≤5yr) pulse rose; everything else is a static glyph. The popup
// carries name/date/location/province/details and the honest REFERENCE badge.
function buildHazardMarker(ev: HazardEvent): maplibregl.Marker {
  const style = HAZARD_STYLE[ev.kind];
  const active = ev.kind === "volcano" && ev.year !== null && new Date().getFullYear() - ev.year <= 5;

  // CRITICAL: MapLibre positions the marker by writing `transform: translate(...)`
  // onto THIS outer element. So the pulse animation (which animates `transform:
  // scale()`) must NOT touch it — otherwise the keyframe clobbers the translate and
  // the marker snaps to the map's 0,0 corner (the bug that hid active volcanoes like
  // Titan Ridge). We pulse an INNER glyph span instead, leaving `el` transform-free.
  const el = document.createElement("div");
  el.className = `newcis-hazard-marker newcis-hazard-${ev.kind}`;
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", `${style.label}: ${ev.name} (${ev.location}, ${ev.date})`);
  el.style.cssText = "cursor:pointer;";

  const glyph = document.createElement("span");
  glyph.style.cssText =
    "display:block;font-size:14px;line-height:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.7));" +
    (active ? "animation:newcis-volcano-pulse 1.6s ease-in-out infinite;filter:drop-shadow(0 0 4px #f43f5e);" : "");
  glyph.textContent = style.glyph;
  el.appendChild(glyph);

  const light = document.documentElement.classList.contains("light");
  const fg = light ? "#18181b" : "#f4f4f5";
  const bg = light ? "#ffffff" : "#18181b";
  const border = light ? "#d4d4d8" : "#3f3f46";

  const html = `<div style="font-family:system-ui;font-size:12px;color:${fg};background:${bg};border:1px solid ${border};padding:7px 9px;border-radius:4px;max-width:240px;">
       <div style="font-weight:600;display:flex;align-items:center;gap:5px;">${style.glyph} ${esc(ev.name)}${active ? ` <span style="color:#f43f5e;font-size:10px;font-weight:700;">ACTIVE</span>` : ""}</div>
       <div style="margin-top:3px;opacity:0.85;">${esc(ev.location)} · ${esc(ev.province)}</div>
       <div style="margin-top:2px;opacity:0.7;">${esc(ev.date)}</div>
       <div style="margin-top:5px;opacity:0.8;line-height:1.4;">${esc(ev.details)}</div>
       <div style="margin-top:5px;opacity:0.55;font-size:10px;">NEWCIS curated record · REFERENCE</div>
     </div>`;

  return new maplibregl.Marker({ element: el, anchor: "center" })
    .setLngLat([ev.lon, ev.lat])
    .setPopup(new maplibregl.Popup({ closeButton: false, offset: 12, className: "newcis-popup" }).setHTML(html));
}

export function HeatMap({ sectorRisk }: { sectorRisk: SectorRisk[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Markers kept per-kind so a layer toggle can mount/unmount just that kind.
  const hazardMarkersRef = useRef<Record<HazardKind, maplibregl.Marker[]>>({
    volcano: [],
    tsunami: [],
    disaster: [],
  });
  const eventsRef = useRef<HazardEvent[]>([]);
  const [basemap, setBasemap] = useState<Basemap>("flat");
  const [visibleLayers, setVisibleLayers] = useState<Record<HazardKind, boolean>>({
    volcano: true,
    tsunami: true,
    disaster: true,
  });
  // Bumped once hazards.json resolves, to re-run the marker-sync effect.
  const [hazardsLoaded, setHazardsLoaded] = useState(0);
  // Bumped when the map finishes loading its style/layers, so the marker effect
  // only mounts markers onto a map whose projection is actually laid out (adding
  // them earlier strands every marker at the 0,0 corner — they get no transform).
  const [mapReady, setMapReady] = useState(0);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const isLight = document.documentElement.classList.contains("light");
    const bgColour = isLight ? "#fafafa" : "#09090b";

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          { id: "bg", type: "background", paint: { "background-color": bgColour } },
        ],
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      },
      center: [144.5, -6.3],
      zoom: 4.6,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on("load", async () => {
      const res = await fetch("/provinces.geojson");
      const geojson = await res.json();
      const worst = worstByProvince(sectorRisk);

      for (const f of geojson.features) {
        const code: string = f.properties.code;
        const level = worst[code];
        f.properties.risk_colour = level ? RISK_COLOUR[level] : (isLight ? "#d4d4d8" : "#27272a");
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
        const light = document.documentElement.classList.contains("light");
        const fg = light ? "#18181b" : "#f4f4f5";
        const bg = light ? "#ffffff" : "#18181b";
        const border = light ? "#d4d4d8" : "#3f3f46";
        new maplibregl.Popup({ closeButton: false, className: "newcis-popup" })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family: system-ui; font-size: 12px; color: ${fg}; background: ${bg}; border: 1px solid ${border}; padding: 6px 8px; border-radius: 4px;">
               <div style="font-weight: 600;">${p.name}</div>
               <div style="opacity: 0.7;">${p.code}</div>
               <div style="margin-top: 4px;">${p.is_focus ? `Risk: <b>${p.risk_level.toUpperCase()}</b>` : "Non-focus (not scored in PoC)"}</div>
             </div>`,
          )
          .addTo(map);
      });

      map.on("mouseenter", "provinces-fill", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "provinces-fill", () => (map.getCanvas().style.cursor = ""));

      // Map is now fully laid out — signal the marker effect it's safe to mount.
      if (mapRef.current === map) setMapReady((n) => n + 1);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [sectorRisk]);

  // Hazard markers — three toggleable layers (volcanoes 🌋, tsunamis 🌊, major
  // disasters ⚠️) plotted at their REAL hand-geocoded coordinates from
  // /public/hazards.json (parsed each ingest from the curated /data CSVs). DOM
  // markers (not a map layer) so they survive basemap swaps and ride above the
  // fill. Every event is curated history → badged REFERENCE, never LIVE. Fetch
  // once into eventsRef; a second effect mounts/unmounts per kind on toggle.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/hazards.json");
        if (res.ok) eventsRef.current = ((await res.json()).events ?? []) as HazardEvent[];
      } catch {
        eventsRef.current = [];
      }
      if (!cancelled) setHazardsLoaded((n) => n + 1);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mount/unmount markers per kind whenever the data loads, the map (re)builds,
  // or a layer is toggled. Markers for a hidden kind are removed entirely so the
  // toggle genuinely declutters the picture.
  useEffect(() => {
    const map = mapRef.current;
    // mapReady === 0 means the current map hasn't fired `load` yet; bail and let
    // the bump re-run this effect. Adding markers before load strands them at 0,0.
    if (!map || mapReady === 0) return;
    const markers = hazardMarkersRef.current;

    for (const kind of HAZARD_KINDS) {
      const shouldShow = visibleLayers[kind];
      const mounted = markers[kind].length > 0;
      if (shouldShow && !mounted) {
        markers[kind] = eventsRef.current
          .filter((ev) => ev.kind === kind && Number.isFinite(ev.lon) && Number.isFinite(ev.lat))
          .map((ev) => buildHazardMarker(ev).addTo(map));
      } else if (!shouldShow && mounted) {
        for (const m of markers[kind]) m.remove();
        markers[kind] = [];
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleLayers, hazardsLoaded, mapReady]);

  // On unmount, drop every hazard marker so none are orphaned after the map is
  // torn down (the map-build effect rebuilds on sectorRisk; this clears stale refs).
  useEffect(() => {
    const markers = hazardMarkersRef.current;
    return () => {
      for (const kind of HAZARD_KINDS) {
        for (const m of markers[kind]) m.remove();
        markers[kind] = [];
      }
    };
  }, [sectorRisk]);

  // Swap the basemap beneath the provinces without rebuilding the map. Two code
  // paths: a single raster source for XYZ basemaps, or — for the keyless ArcGIS
  // VectorTileServer — fetch its Mapbox-style root.json and inject its sources +
  // layers (prefixed so we can tear them down on the next swap).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    // Remove whatever basemap is currently mounted (raster OR esri-vector).
    const teardown = () => {
      if (map.getLayer("basemap")) map.removeLayer("basemap");
      if (map.getSource("basemap")) map.removeSource("basemap");
      for (const layer of map.getStyle().layers ?? []) {
        if (layer.id.startsWith(ESRI_LAYER_PREFIX) && map.getLayer(layer.id)) {
          map.removeLayer(layer.id);
        }
      }
      for (const id of Object.keys(map.getStyle().sources ?? {})) {
        if (id.startsWith(ESRI_SOURCE_PREFIX) && map.getSource(id)) {
          map.removeSource(id);
        }
      }
    };

    const beforeLayer = () => (map.getLayer("provinces-fill") ? "provinces-fill" : undefined);

    const applyRaster = () => {
      const cfg = BASEMAPS[basemap];
      if (!cfg) return;
      map.addSource("basemap", {
        type: "raster",
        tiles: cfg.tiles,
        tileSize: 256,
        attribution: cfg.attribution,
      });
      map.addLayer({ id: "basemap", type: "raster", source: "basemap" }, beforeLayer());
    };

    const applyEsriVector = async () => {
      const styleRes = await fetch(ESRI_VECTOR_STYLE_URL);
      if (!styleRes.ok) return;
      const style = await styleRes.json();
      if (cancelled || !mapRef.current) return;

      // Relative refs in root.json resolve against the style URL's directory.
      // `new URL()` percent-encodes braces, so it would turn the glyphs template
      // "{fontstack}/{range}" into "%7Bfontstack%7D/%7Brange%7D" — which MapLibre
      // rejects ("url must include a {fontstack} token"). Decode the brace tokens
      // back after resolving so templated URLs survive.
      const base = ESRI_VECTOR_STYLE_URL.replace(/\/[^/]*$/, "/");
      const resolve = (u: string) =>
        (u.startsWith("http") ? u : new URL(u, base).toString())
          .replace(/%7B/gi, "{")
          .replace(/%7D/gi, "}");

      // Point glyphs + sprite at Esri's services so symbol (label/icon) layers
      // render instead of 404-ing against the demotiles endpoints.
      if (style.glyphs && typeof map.setGlyphs === "function") {
        map.setGlyphs(resolve(style.glyphs));
      }
      if (style.sprite && typeof map.setSprite === "function") {
        map.setSprite(resolve(style.sprite));
      }

      // Map the style's source names → our prefixed names so we can rename them
      // in each layer's `source` ref and tear them down cleanly later.
      //
      // The style's source `url` (e.g. "../../") resolves to the ArcGIS
      // VectorTileServer ROOT, which returns *Esri* service metadata — NOT
      // MapLibre-compatible TileJSON. Handing that url straight to MapLibre
      // makes the source load nothing (the bug that made esri-vector look
      // identical to flat). So we fetch the service metadata ourselves, read its
      // `tiles` template + `tileInfo.lods`, and build an explicit vector source
      // with absolute tile URLs.
      const rename: Record<string, string> = {};
      for (const [name, src] of Object.entries(
        style.sources as Record<string, { url?: string; type: string }>,
      )) {
        const id = `${ESRI_SOURCE_PREFIX}-${name}`;
        rename[name] = id;
        if (map.getSource(id)) continue;

        if (src.type === "vector" && src.url) {
          const serviceRoot = resolve(src.url).replace(/\/?$/, "/");
          const metaRes = await fetch(`${serviceRoot}?f=json`);
          if (!metaRes.ok || cancelled || !mapRef.current) return;
          const meta = (await metaRes.json()) as {
            tiles?: string[];
            tileInfo?: { lods?: { level: number }[] };
          };
          const template = meta.tiles?.[0] ?? "tile/{z}/{y}/{x}.pbf";
          const lods = meta.tileInfo?.lods ?? [];
          const levels = lods.map((l) => l.level);
          map.addSource(id, {
            type: "vector",
            tiles: [`${serviceRoot}${template}`],
            minzoom: levels.length ? Math.min(...levels) : 0,
            maxzoom: levels.length ? Math.max(...levels) : 22,
            attribution: BASEMAPS["esri-vector"]?.attribution,
          });
        } else {
          map.addSource(id, {
            ...src,
            ...(src.url ? { url: resolve(src.url) } : {}),
            attribution: BASEMAPS["esri-vector"]?.attribution,
          } as maplibregl.SourceSpecification);
        }
      }

      const before = beforeLayer();
      for (const layer of style.layers as Array<{ id: string; source?: string }>) {
        const injected = {
          ...layer,
          id: `${ESRI_LAYER_PREFIX}${layer.id}`,
          ...(layer.source ? { source: rename[layer.source] ?? layer.source } : {}),
        };
        if (map.getLayer(injected.id)) continue;
        map.addLayer(injected as maplibregl.LayerSpecification, before);
      }
    };

    const apply = () => {
      teardown();
      if (basemap === "flat") return;
      if (basemap === "esri-vector") void applyEsriVector();
      else applyRaster();
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);

    return () => {
      cancelled = true;
    };
  }, [basemap]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full h-[320px] md:h-[440px] rounded-lg border border-border-subtle overflow-hidden"
      />
      <div
        className="absolute top-3 left-3 flex flex-col gap-0.5 bg-[var(--surface-overlay)] backdrop-blur border border-border-subtle rounded-md p-0.5 shadow-[var(--elevation-2)]"
        role="group"
        aria-label="Hazard layers"
      >
        {HAZARD_KINDS.map((kind) => {
          const on = visibleLayers[kind];
          return (
            <button
              key={kind}
              type="button"
              role="switch"
              aria-checked={on}
              onClick={() => setVisibleLayers((v) => ({ ...v, [kind]: !v[kind] }))}
              className={`px-2 py-1 text-[10px] tracking-[0.04em] font-medium rounded transition-colors inline-flex items-center gap-1.5 ${
                on ? "bg-surface-3 text-text-1" : "text-text-muted hover:text-text-1"
              }`}
            >
              <span aria-hidden style={{ opacity: on ? 1 : 0.4 }}>
                {HAZARD_STYLE[kind].glyph}
              </span>
              {HAZARD_STYLE[kind].label}
            </button>
          );
        })}
      </div>
      <div
        className="absolute top-3 right-3 flex gap-0.5 bg-[var(--surface-overlay)] backdrop-blur border border-border-subtle rounded-md p-0.5 shadow-[var(--elevation-2)]"
        role="radiogroup"
        aria-label="Basemap"
      >
        {(Object.keys(BASEMAPS) as Basemap[]).map((b) => (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={basemap === b}
            onClick={() => setBasemap(b)}
            className={`px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] font-medium rounded transition-colors ${
              basemap === b
                ? "bg-surface-3 text-text-1"
                : "text-text-muted hover:text-text-1"
            }`}
          >
            {b === "flat" ? "Flat" : BASEMAPS[b]?.label}
          </button>
        ))}
      </div>
      <div className="absolute bottom-3 left-3 bg-[var(--surface-overlay)] backdrop-blur border border-border-subtle rounded-md px-2.5 py-1.5 text-[10px] uppercase tracking-[0.08em] text-text-muted flex items-center gap-3 shadow-[var(--elevation-2)]">
        {(["low", "med", "high", "critical"] as RiskLevel[]).map((lv) => (
          <span key={lv} className="inline-flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-sm"
              style={{ background: RISK_COLOUR[lv] }}
            />
            {lv}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-text-disabled">
          <span className="w-2 h-2 rounded-sm bg-border-default" />
          non-focus
        </span>
        {HAZARD_KINDS.map((kind) => (
          <span key={kind} className="inline-flex items-center gap-1.5 text-text-disabled normal-case">
            <span aria-hidden>{HAZARD_STYLE[kind].glyph}</span>
            {HAZARD_STYLE[kind].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-text-disabled">
          curated · REFERENCE
        </span>
      </div>
    </div>
  );
}
