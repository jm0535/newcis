// src/lib/sitrep-visuals.ts
// Pure server-side SVG builders for the SITREP. The dashboard's visuals are
// React/client components and cannot be used in standalone HTML or in Word — so
// every report visual is rebuilt here as a plain SVG string: data in, SVG out.
// Inline attributes only (no external CSS) so the markup survives BOTH inline
// embedding in the print HTML and rasterization to PNG for the .docx.
import type { NationalStatus, RiskLevel } from "./types";
import { RISK_COLOUR, ALERT_COLOUR } from "./ui";
import { PHASE_SHORT } from "./national-language";

// --- shared helpers ---------------------------------------------------------

const INK = "#18181b";
const MUTED = "#71717a";
const LINE = "#e4e4e7";
const PRINT_BG = "#ffffff";

export function svgEsc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function groupThousands(n: number): string {
  return n.toLocaleString("en-US");
}

// Open/close an SVG root at a fixed viewBox; width/height let the HTML/raster
// caller scale uniformly.
function svgRoot(w: number, h: number, body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ` +
    `width="${w}" height="${h}" font-family="-apple-system, system-ui, sans-serif">` +
    `<rect width="${w}" height="${h}" fill="${PRINT_BG}"/>${body}</svg>`
  );
}

// The 4-swatch traffic-light legend shared by the matrix and the map.
function legendStrip(x: number, y: number): string {
  const items: { level: RiskLevel; label: string }[] = [
    { level: "low", label: "Low" },
    { level: "med", label: "Medium" },
    { level: "high", label: "High" },
    { level: "critical", label: "Critical" },
  ];
  let out = "";
  let cx = x;
  for (const it of items) {
    out +=
      `<rect x="${cx}" y="${y}" width="12" height="12" rx="2" fill="${RISK_COLOUR[it.level]}" stroke="${LINE}"/>` +
      `<text x="${cx + 17}" y="${y + 10}" font-size="11" fill="${MUTED}">${it.label}</text>`;
    cx += 17 + it.label.length * 7 + 16;
  }
  return out;
}

// --- KPI band ---------------------------------------------------------------

// Six executive KPI cells in a 3×2 grid: ENSO phase, National Alert (cell tinted
// by the alert traffic-light), National Risk, Affected Population, High-Risk
// Provinces, Forecast Period. Mirrors the dashboard KpiStrip, flattened to print.
export function kpiBandSvg(national: NationalStatus | null): string {
  const W = 960;
  if (!national) {
    return svgRoot(
      W,
      90,
      `<rect x="8" y="8" width="${W - 16}" height="74" rx="6" fill="#fafafa" stroke="${LINE}"/>` +
        `<text x="${W / 2}" y="52" text-anchor="middle" font-size="15" fill="${MUTED}">No national status this cycle.</text>`,
    );
  }

  const cells: { label: string; value: string; sub?: string; fill?: string; color?: string }[] = [
    { label: "ENSO Phase", value: PHASE_SHORT[national.enso_phase] },
    {
      label: "National Alert",
      value: national.alert_level,
      fill: ALERT_COLOUR[national.alert_level],
      color: national.alert_level === "AMBER" ? INK : "#ffffff",
    },
    { label: "National Risk", value: national.national_risk_rating.toUpperCase() },
    {
      label: "Affected Population (est.)",
      value: national.affected_population_est > 0 ? groupThousands(national.affected_population_est) : "—",
    },
    { label: "High-Risk Provinces", value: String(national.high_risk_province_count) },
    { label: "Forecast Period", value: national.forecast_period },
  ];

  const cols = 3;
  const cw = (W - 16 - (cols - 1) * 10) / cols;
  const ch = 84;
  const rows = 2;
  const H = 16 + rows * ch + (rows - 1) * 10;

  let body = "";
  cells.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 8 + col * (cw + 10);
    const y = 8 + row * (ch + 10);
    const bg = c.fill ?? "#fafafa";
    const valColor = c.color ?? INK;
    body +=
      `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="6" fill="${bg}" stroke="${LINE}"/>` +
      `<text x="${x + 12}" y="${y + 22}" font-size="11" letter-spacing="0.06em" fill="${c.fill ? valColor : MUTED}">${svgEsc(c.label.toUpperCase())}</text>` +
      `<text x="${x + 12}" y="${y + 56}" font-size="26" font-weight="700" fill="${valColor}">${svgEsc(c.value)}</text>`;
  });

  return svgRoot(W, H, body);
}

export { legendStrip, svgRoot, groupThousands, INK, MUTED, LINE };
