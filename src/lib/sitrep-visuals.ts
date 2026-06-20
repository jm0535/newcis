// src/lib/sitrep-visuals.ts
// Pure server-side SVG builders for the SITREP. The dashboard's visuals are
// React/client components and cannot be used in standalone HTML or in Word — so
// every report visual is rebuilt here as a plain SVG string: data in, SVG out.
// Inline attributes only (no external CSS) so the markup survives BOTH inline
// embedding in the print HTML and rasterization to PNG for the .docx.
import type { NationalStatus, RiskLevel, SectorRisk, Sector, Indicator, HistoricalReading, ProvinceFC } from "./types";
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

// Clip a label to a pixel budget assuming ~px-per-char for the given font size,
// appending an ellipsis when cut. Keeps SVG titles from overrunning their cell.
function truncate(s: string, maxChars: number): string {
  return s.length > maxChars ? `${s.slice(0, maxChars - 1).trimEnd()}…` : s;
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

// Short level labels and on-cell text colour, mirroring the dashboard
// RiskMatrix.tsx so the printed matrix reads with the same vocabulary.
const LEVEL_LABEL: Record<RiskLevel, string> = {
  low: "LOW",
  med: "MED",
  high: "HIGH",
  critical: "CRITICAL",
};
// Vivid low/med cells read best with dark text; dark high/critical need light.
const LEVEL_TEXT: Record<RiskLevel, string> = {
  low: "#18181b",
  med: "#18181b",
  high: "#ffffff",
  critical: "#ffffff",
};

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

  const provinceCodes = sortedCodes;
  const labelW = 160; // sector name + provenance pill
  const natW = 58; // wide enough for "CRITICAL ×22" on two short lines
  const cellW = 28;
  const cellH = 30;
  // 22 province labels won't fit horizontally over 28px cells — they overlap into
  // an unreadable smear. Rotate the headers -45° and reserve a taller header band
  // so each label rises clear of its neighbour.
  const headH = 96;
  const W = labelW + natW + provinceCodes.length * cellW + 16;
  const H = headH + SECTORS.length * cellH + 64;

  // Per-sector roll-up: worst level, how many provinces sit at that worst level,
  // and whether any cell in the sector is LIVE — mirrors RiskMatrix.tsx so the
  // National column and the LIVE/DEMO pills match the dashboard exactly.
  const rollup = (sector: Sector) => {
    const rows = focusRisk.filter((r) => r.sector === sector);
    const level = worstLevel(rows);
    const count = level ? rows.filter((r) => r.level === level).length : 0;
    const live = rows.some((r) => r.provenance === "LIVE");
    return { level, count, live };
  };

  let body = "";

  // Column headers. National label sits over its wide column; province labels are
  // rotated -45° so 22 of them stay legible above narrow cells.
  body += `<text x="${labelW + natW / 2}" y="${headH - 10}" text-anchor="middle" font-size="11" font-weight="700" fill="${INK}">National</text>`;
  provinceCodes.forEach((c, ci) => {
    const x = labelW + natW + ci * cellW + cellW / 2;
    const label = FOCUS_SHORT_LABELS[c] ?? c;
    body += `<text x="${x}" y="${headH - 8}" text-anchor="start" font-size="11" font-weight="600" fill="${INK}" transform="rotate(-45 ${x} ${headH - 8})">${svgEsc(label)}</text>`;
  });

  // Rows.
  SECTORS.forEach((sector, ri) => {
    const y = headH + ri * cellH;
    const roll = rollup(sector);
    // Sector name + provenance pill (LIVE green, DEMO violet — the credibility rule).
    body += `<text x="8" y="${y + cellH / 2 + 4}" font-size="12" fill="${INK}">${svgEsc(sector)}</text>`;
    const pill = roll.live
      ? { bg: "#dcfce7", fg: "#166534", txt: "LIVE" }
      : { bg: "#ede9fe", fg: "#5b21b6", txt: "DEMO" };
    body +=
      `<rect x="${labelW - 38}" y="${y + cellH / 2 - 7}" width="34" height="14" rx="3" fill="${pill.bg}"/>` +
      `<text x="${labelW - 21}" y="${y + cellH / 2 + 3}" text-anchor="middle" font-size="9" font-weight="700" fill="${pill.fg}">${pill.txt}</text>`;

    // National roll-up cell: worst level label + ×count of provinces at that level.
    const nx = labelW;
    const nFill = roll.level ? RISK_COLOUR[roll.level] : "#f4f4f5";
    const nText = roll.level ? LEVEL_TEXT[roll.level] : MUTED;
    body += `<rect x="${nx + 1}" y="${y + 1}" width="${natW - 2}" height="${cellH - 2}" rx="3" fill="${nFill}" stroke="${LINE}"/>`;
    if (roll.level) {
      body +=
        `<text x="${nx + natW / 2}" y="${y + cellH / 2 - 1}" text-anchor="middle" font-size="9" font-weight="700" fill="${nText}">${LEVEL_LABEL[roll.level]}</text>` +
        `<text x="${nx + natW / 2}" y="${y + cellH / 2 + 9}" text-anchor="middle" font-size="8" fill="${nText}">×${roll.count}</text>`;
    }

    // Province cells: traffic-light square + trend glyph.
    provinceCodes.forEach((c, ci) => {
      const x = labelW + natW + ci * cellW;
      const cell = focusRisk.find((r) => r.province_code === c && r.sector === sector);
      const level = cell?.level ?? null;
      // Trend glyph in every populated cell — rising/falling, and a flat dash so
      // "no change this cycle" reads as a deliberate state, not a missing value
      // (mirrors the dashboard, where flat cells carry the em-dash).
      const glyph = cell ? (cell.trend === "up" ? "▲" : cell.trend === "down" ? "▼" : "—") : "";
      const fill = level ? RISK_COLOUR[level] : "#f4f4f5";
      const gColor = level ? LEVEL_TEXT[level] : MUTED;
      body += `<rect x="${x + 1}" y="${y + 1}" width="${cellW - 2}" height="${cellH - 2}" rx="3" fill="${fill}" stroke="${LINE}"/>`;
      if (glyph) body += `<text x="${x + cellW / 2}" y="${y + cellH / 2 + 4}" text-anchor="middle" font-size="10" fill="${gColor}">${glyph}</text>`;
    });
  });

  // Legends: severity swatches (row 1), then trend + source keys (row 2).
  const legY = H - 38;
  body += legendStrip(8, legY);
  body +=
    `<text x="8" y="${legY + 26}" font-size="10" fill="${MUTED}">` +
    `Trend ▲ rising · ▼ falling · — flat` +
    `</text>` +
    `<rect x="220" y="${legY + 16}" width="32" height="13" rx="3" fill="#dcfce7"/>` +
    `<text x="236" y="${legY + 26}" text-anchor="middle" font-size="9" font-weight="700" fill="#166534">LIVE</text>` +
    `<text x="258" y="${legY + 26}" font-size="10" fill="${MUTED}">real feed</text>` +
    `<rect x="318" y="${legY + 16}" width="36" height="13" rx="3" fill="#ede9fe"/>` +
    `<text x="336" y="${legY + 26}" text-anchor="middle" font-size="9" font-weight="700" fill="#5b21b6">DEMO</text>` +
    `<text x="360" y="${legY + 26}" font-size="10" fill="${MUTED}">seeded placeholder</text>`;
  return svgRoot(W, H, body);
}

// --- Indicator trends -------------------------------------------------------

// Small-multiples grid (3 across): one mini line chart per indicator that has at
// least two historical readings. Each chart shows the last ≤12 points for that
// key, a zero baseline, auto-scaled min/max, the latest value labelled, and the
// indicator label as title. Indicators with <2 points are skipped.
export function trendChartSvg(
  history: HistoricalReading[],
  indicators: Indicator[],
): string {
  const series = indicators
    .map((ind) => {
      const pts = history
        .filter((h) => h.key === ind.key)
        .sort((a, b) => a.observed_at.localeCompare(b.observed_at))
        .slice(-12);
      return { ind, pts };
    })
    .filter((s) => s.pts.length >= 2);

  if (!series.length) {
    return svgRoot(
      600,
      80,
      `<text x="300" y="46" text-anchor="middle" font-size="14" fill="${MUTED}">No trend history available.</text>`,
    );
  }

  const cols = 3;
  const cw = 300;
  const ch = 150;
  const pad = 14;
  const headH = 46; // title + value/unit subline above the plot
  const rows = Math.ceil(series.length / cols);
  const W = cols * cw + 16;
  const H = rows * ch + 16;

  let body = "";
  series.forEach((s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ox = 8 + col * cw;
    const oy = 8 + row * ch;
    const plotW = cw - 2 * pad;
    const plotH = ch - headH - pad;
    const px = ox + pad;
    const py = oy + headH;

    const vals = s.pts.map((p) => p.value);
    let min = Math.min(0, ...vals);
    let max = Math.max(0, ...vals);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const sx = (idx: number) => px + (idx / (s.pts.length - 1)) * plotW;
    const sy = (v: number) => py + plotH - ((v - min) / (max - min)) * plotH;
    const last = s.pts[s.pts.length - 1];

    // Header: title on its own line (truncated to the cell width), then a subline
    // with the latest value and unit. Nothing shares a baseline, so no overlap.
    body += `<text x="${px}" y="${oy + 16}" font-size="12" font-weight="600" fill="${INK}">${svgEsc(truncate(s.ind.label, 40))}</text>`;
    body += `<text x="${px}" y="${oy + 36}" font-size="13" font-weight="700" fill="#2563eb">${last.value}<tspan font-size="11" font-weight="400" fill="${MUTED}"> ${svgEsc(s.ind.unit)}</tspan></text>`;
    // Frame + zero baseline.
    body += `<rect x="${px}" y="${py}" width="${plotW}" height="${plotH}" fill="#fafafa" stroke="${LINE}"/>`;
    if (min < 0 && max > 0) {
      const zy = sy(0);
      body += `<line x1="${px}" y1="${zy}" x2="${px + plotW}" y2="${zy}" stroke="#d4d4d8" stroke-dasharray="3 3"/>`;
    }
    // Line.
    const d = s.pts.map((p, idx) => `${idx === 0 ? "M" : "L"}${sx(idx).toFixed(1)},${sy(p.value).toFixed(1)}`).join(" ");
    body += `<path d="${d}" fill="none" stroke="#2563eb" stroke-width="2"/>`;
    // Latest-point marker.
    body += `<circle cx="${sx(s.pts.length - 1).toFixed(1)}" cy="${sy(last.value).toFixed(1)}" r="3" fill="#2563eb"/>`;
  });

  return svgRoot(W, H, body);
}

export { legendStrip, svgRoot, groupThousands, INK, MUTED, LINE };

// --- Provincial map ---------------------------------------------------------

// Project all province MultiPolygons to SVG paths via a linear lon/lat → viewBox
// fit (bbox over every coordinate, scale to fit, flip Y for screen space). Each
// province is filled by its worst sector level; provinces with no risk data show
// neutral grey. A simple equirectangular fit is fine at PNG-demo scale.
export function provincialMapSvg(geojson: ProvinceFC, sectorRisk: SectorRisk[]): string {
  if (!geojson.features.length) {
    return svgRoot(
      600,
      80,
      `<text x="300" y="46" text-anchor="middle" font-size="14" fill="${MUTED}">No province geometry available.</text>`,
    );
  }

  // bbox over all coordinates.
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const f of geojson.features) {
    for (const poly of f.geometry.coordinates) {
      for (const ring of poly) {
        for (const [lon, lat] of ring) {
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
      }
    }
  }

  const W = 760, H = 620, M = 24, titleH = 28, legendH = 30;
  const plotW = W - 2 * M;
  const plotH = H - 2 * M - titleH - legendH;
  const spanLon = maxLon - minLon || 1;
  const spanLat = maxLat - minLat || 1;
  const scale = Math.min(plotW / spanLon, plotH / spanLat);
  const ox = M + (plotW - spanLon * scale) / 2;
  const oy = M + titleH;
  const projX = (lon: number) => ox + (lon - minLon) * scale;
  const projY = (lat: number) => oy + (maxLat - lat) * scale; // flip Y

  // Worst level per province code.
  const worstByCode = new Map<string, RiskLevel>();
  for (const r of sectorRisk) {
    const cur = worstByCode.get(r.province_code);
    if (!cur || LEVEL_RANK[r.level] > LEVEL_RANK[cur]) worstByCode.set(r.province_code, r.level);
  }

  let body = `<text x="${M}" y="${M + 14}" font-size="14" font-weight="600" fill="${INK}">Provincial risk — worst sector per province</text>`;

  for (const f of geojson.features) {
    const level = worstByCode.get(f.properties.code) ?? null;
    const fill = level ? RISK_COLOUR[level] : "#e4e4e7";
    for (const poly of f.geometry.coordinates) {
      for (const ring of poly) {
        const d = ring
          .map(([lon, lat], idx) => `${idx === 0 ? "M" : "L"}${projX(lon).toFixed(1)},${projY(lat).toFixed(1)}`)
          .join(" ") + " Z";
        body += `<path d="${d}" fill="${fill}" stroke="#ffffff" stroke-width="0.8"/>`;
      }
    }
  }

  body += legendStrip(M, H - legendH + 4);
  return svgRoot(W, H, body);
}
