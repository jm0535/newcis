// Curated historical-hazard events for the provincial heat map. Split out of
// HeatMap.tsx to keep that component under the 500-line budget: this module owns
// the hazard data model, per-kind presentation, and the DOM-marker builder; the
// component owns the map lifecycle and React state.
//
// Each event is a curated record at its REAL (hand-geocoded) coordinates, parsed
// each ingest from the /data CSVs into /public/hazards.json. Three kinds —
// volcanoes, tsunamis, major disasters — each its own toggleable map layer.
// Provenance is REFERENCE (curated record), never LIVE.
import maplibregl from "maplibre-gl";

export type HazardKind = "volcano" | "tsunami" | "disaster";

export interface HazardEvent {
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
export const HAZARD_STYLE: Record<HazardKind, { glyph: string; colour: string; label: string }> = {
  volcano: { glyph: "🌋", colour: "#f43f5e", label: "Volcanoes" },
  tsunami: { glyph: "🌊", colour: "#38bdf8", label: "Tsunamis" },
  disaster: { glyph: "⚠️", colour: "#fbbf24", label: "Landslides / cyclones" },
};

export const HAZARD_KINDS: HazardKind[] = ["volcano", "tsunami", "disaster"];

// Escape free-text fields before they go into a popup's innerHTML.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Build one DOM marker for a curated hazard event. Volcanoes within the active
// window (≤5yr) pulse rose; everything else is a static glyph. Clicking the marker
// routes its name/date/location/province/details + REFERENCE badge through the ONE
// shared popup (showPopup) so no two popups ever stack — and stops the click from
// also reaching the province-fill layer beneath (the overlap bug).
export function buildHazardMarker(
  ev: HazardEvent,
  showPopup: (lngLat: [number, number], html: string) => void,
): maplibregl.Marker {
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

  el.addEventListener("click", (e) => {
    e.stopPropagation(); // don't let the province-fill click handler also fire
    showPopup([ev.lon, ev.lat], html);
  });

  return new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([ev.lon, ev.lat]);
}
