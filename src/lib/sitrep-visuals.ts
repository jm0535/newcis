// src/lib/sitrep-visuals.ts
// Pure server-side SVG builders for the SITREP. The dashboard's visuals are
// React/client components and cannot be used in standalone HTML or in Word — so
// every report visual is rebuilt here as a plain SVG string: data in, SVG out.
// Inline attributes only (no external CSS) so the markup survives BOTH inline
// embedding in the print HTML and rasterization to PNG for the .docx.
import type { NationalStatus, RiskLevel, SectorRisk, Sector } from "./types";
import { RISK_COLOUR, ALERT_COLOUR } from "./ui";
import { PHASE_SHORT } from "./national-language";
import { FOCUS_CODES, FOCUS_SHORT_LABELS } from "./focus-provinces";

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

// --- Risk matrix ------------------------------------------------------------

// All 8 sectors, in dashboard RiskMatrix.tsx order (mirror it exactly —
// "Disaster & Hazard" is the 8th and must not be dropped).
const SECTORS: Sector[] = [
  "Food Security",
  "Water Security",
  "Public Health",
  "Economic Stability",
  "Infrastructure",
  "Energy Security",
  "Social Stability",
  "Disaster & Hazard",
];

const LEVEL_RANK: Record<RiskLevel, number> = { low: 0, med: 1, high: 2, critical: 3 };

function worstLevel(rows: SectorRisk[]): RiskLevel | null {
  if (!rows.length) return null;
  return rows.reduce<RiskLevel>(
    (acc, r) => (LEVEL_RANK[r.level] > LEVEL_RANK[acc] ? r.level : acc),
    "low",
  );
}

// Rows = the 8 sectors. Columns = a leading National column (the sector's worst
// level across the provinces present in data) then one column per province,
// sorted worst-first to mirror the dashboard RiskMatrix.tsx (total level-weight
// desc, then peak, then name). Count-agnostic: render whatever province codes
// appear in `sectorRisk` (the live set is 22). Each cell is a traffic-light
// square; the National cell shows a count of provinces at HIGH/CRITICAL for that
// sector. Cells are narrow (28px) so all 22 columns fit an A4 print width.
// Legend strip beneath.
export function riskMatrixSvg(sectorRisk: SectorRisk[]): string {
  const focusRisk = sectorRisk.filter((r) => FOCUS_CODES.includes(r.province_code));
  if (!focusRisk.length) {
    return svgRoot(
      600,
      80,
      `<text x="300" y="46" text-anchor="middle" font-size="14" fill="${MUTED}">No sector cells this cycle.</text>`,
    );
  }

  // Province codes present in data, sorted worst-first (mirror RiskMatrix.tsx).
  const codesPresent = [...new Set(focusRisk.map((r) => r.province_code))];
  const provTotal = (code: string) =>
    focusRisk
      .filter((r) => r.province_code === code)
      .reduce((sum, r) => sum + LEVEL_RANK[r.level], 0);
  const provPeak = (code: string) =>
    Math.max(0, ...focusRisk.filter((r) => r.province_code === code).map((r) => LEVEL_RANK[r.level]));
  const sortedCodes = codesPresent.sort(
    (a, b) =>
      provTotal(b) - provTotal(a) ||
      provPeak(b) - provPeak(a) ||
      (FOCUS_SHORT_LABELS[a] ?? a).localeCompare(FOCUS_SHORT_LABELS[b] ?? b),
  );

  const cols = ["National", ...sortedCodes];
  const labelW = 150;
  const cellW = 28;
  const cellH = 30;
  const headH = 40;
  const W = labelW + cols.length * cellW + 16;
  const H = headH + SECTORS.length * cellH + 48;

  let body = "";

  // Column headers.
  cols.forEach((c, ci) => {
    const x = labelW + ci * cellW + cellW / 2;
    const label = c === "National" ? "National" : FOCUS_SHORT_LABELS[c] ?? c;
    body += `<text x="${x}" y="${headH - 14}" text-anchor="middle" font-size="11" font-weight="600" fill="${INK}">${svgEsc(label)}</text>`;
  });

  // Rows.
  SECTORS.forEach((sector, ri) => {
    const y = headH + ri * cellH;
    body += `<text x="8" y="${y + cellH / 2 + 4}" font-size="12" fill="${INK}">${svgEsc(sector)}</text>`;

    cols.forEach((c, ci) => {
      const x = labelW + ci * cellW;
      let level: RiskLevel | null;
      let badge = "";
      if (c === "National") {
        const rows = focusRisk.filter((r) => r.sector === sector);
        level = worstLevel(rows);
        const hi = rows.filter((r) => r.level === "high" || r.level === "critical").length;
        if (hi > 0) badge = `<text x="${x + cellW - 8}" y="${y + cellH / 2 + 4}" text-anchor="end" font-size="11" font-weight="700" fill="#ffffff">${hi}</text>`;
      } else {
        const cell = focusRisk.find((r) => r.province_code === c && r.sector === sector);
        level = cell?.level ?? null;
        const tr = cell?.trend;
        const glyph = tr === "up" ? "▲" : tr === "down" ? "▼" : "";
        if (glyph) badge = `<text x="${x + cellW - 8}" y="${y + cellH / 2 + 4}" text-anchor="end" font-size="10" fill="#ffffff">${glyph}</text>`;
      }
      const fill = level ? RISK_COLOUR[level] : "#f4f4f5";
      body +=
        `<rect x="${x + 1}" y="${y + 1}" width="${cellW - 2}" height="${cellH - 2}" rx="3" fill="${fill}" stroke="${LINE}"/>` +
        badge;
    });
  });

  body += legendStrip(8, H - 26);
  return svgRoot(W, H, body);
}

export { legendStrip, svgRoot, groupThousands, INK, MUTED, LINE };
