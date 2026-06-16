// Static data + presentation maps for the landing page. Split out of page.tsx to
// keep that file under the 500-line budget. Nothing here reads live data — these
// are the labels, palettes, nav links, and the capability/partner lists.
import {
  Activity,
  Radio,
  CloudSun,
  Map as MapIcon,
  Grid3x3,
  FileText,
  Waves,
  Satellite,
  Wind,
  Database,
  ShieldAlert,
  Mountain,
  Siren,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AlertLevel, NationalStatus } from "@/lib/types";

export const ENSO_LABEL: Record<NationalStatus["enso_phase"], string> = {
  neutral: "ENSO Neutral",
  el_nino_watch: "El Niño Watch",
  el_nino_alert: "El Niño Alert",
  la_nina_watch: "La Niña Watch",
  la_nina_alert: "La Niña Alert",
};

export const ALERT_DOT: Record<AlertLevel, string> = {
  GREEN: "bg-status-green",
  AMBER: "bg-status-amber",
  RED: "bg-status-red",
  BLACK: "bg-status-black",
};

export const ALERT_TEXT: Record<AlertLevel, string> = {
  GREEN: "text-status-green",
  AMBER: "text-status-amber",
  RED: "text-status-red",
  BLACK: "text-text-1",
};

export const ALERT_BLURB: Record<AlertLevel, string> = {
  GREEN: "Routine monitoring — no active ENSO signal.",
  AMBER: "ENSO watch — conditions worth close attention.",
  RED: "ENSO alert — elevated national risk.",
  BLACK: "National emergency footing.",
};

export const fmtPop = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n.toLocaleString();

// Primary nav, mirrored from PageNav so the landing page reads as the same
// product. Links jump straight into the operating picture.
export const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/climate", label: "ENSO Climate" },
  { href: "/forecast", label: "Forecast" },
  { href: "/sectors", label: "Sectoral Impact" },
  { href: "/topology", label: "Risk Topology" },
  { href: "/operations", label: "Operations" },
];

// The "what's inside" gallery — each capability as a content card with its own
// provenance signature, the way a geospatial portal surfaces featured layers.
export const CAPABILITIES = [
  {
    href: "/dashboard",
    icon: Grid3x3,
    title: "National Risk Matrix",
    body: "Every sector × province, traffic-light coloured and sorted worst-first — the primary executive artifact.",
    tag: "LIVE + DEMO",
    tone: "mixed" as const,
  },
  {
    href: "/dashboard",
    icon: MapIcon,
    title: "Provincial Heat Map",
    body: "All 22 provinces on an interactive map with toggleable volcano, tsunami and disaster hazard layers.",
    tag: "LIVE + REFERENCE",
    tone: "mixed" as const,
  },
  {
    href: "/climate",
    icon: CloudSun,
    title: "ENSO Climate Intelligence",
    body: "ONI, SOI, SST and rainfall gauged against config-driven thresholds, with 12-month trend lines.",
    tag: "LIVE",
    tone: "live" as const,
  },
  {
    href: "/operations",
    icon: FileText,
    title: "Weekly SITREP",
    body: "One-click executive situation report — national status, top movers and recommended actions.",
    tag: "GENERATED",
    tone: "neutral" as const,
  },
];

export const TONE_CLASS: Record<"live" | "mixed" | "neutral", string> = {
  live: "bg-status-green/15 text-status-green border-status-green/40",
  mixed: "bg-accent/15 text-accent border-accent/40",
  neutral: "bg-surface-2 text-text-muted border-border-default",
};

// Data partners — the "trusted sources" behind the pipeline, rendered as an
// animated marquee of branded chips (PartnerMarquee). We deliberately do NOT use
// the agencies' real logos: that would be a trademark/licensing risk and we'd be
// hot-linking external assets. Instead each partner is a self-drawn chip (acronym
// + a lucide glyph for its domain + the data role it plays), which is honest,
// on-brand, and needs no third-party asset. `glyph` is the icon; `role` is the
// one-word feed it provides.
export interface Partner {
  name: string;
  role: string;
  glyph: LucideIcon;
}

export const PARTNERS: Partner[] = [
  { name: "NOAA CPC", role: "ENSO · ONI", glyph: Waves },
  { name: "NASA", role: "Soil · vegetation", glyph: Satellite },
  { name: "BoM", role: "SOI", glyph: Wind },
  { name: "HDX HAPI", role: "Food security", glyph: Database },
  { name: "ACLED", role: "Conflict events", glyph: ShieldAlert },
  { name: "USGS", role: "Earthquakes", glyph: Mountain },
  { name: "GDACS", role: "Disaster alerts", glyph: Siren },
  { name: "PNG NSO/UNFPA", role: "Population", glyph: Users },
];

// KPI tiles for the live status band. Icons live here; the band wires values
// from live national data at render time.
export const KPI_ICONS = { Activity, Radio, CloudSun, MapIcon };
