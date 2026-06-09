// Weekly SITREP generator. Pure-ish (one new Date()) — given current data it
// produces a templated HTML report following the NEWCIS concept's SITREP
// structure: status, indicators, provincial risk, sector highlights, actions.
//
// HTML is intentionally print-stylesheet-friendly: a B&W document is the
// fallback artefact at PoC scale.
import type {
  Indicator,
  LastRun,
  NationalStatus,
  RiskLevel,
  Sector,
  SectorRisk,
  Sitrep,
} from "./types";
import { FOCUS_NAMES } from "./focus-provinces";

const ENSO_LABEL: Record<NationalStatus["enso_phase"], string> = {
  neutral: "ENSO Neutral",
  el_nino_watch: "El Niño Watch",
  el_nino_alert: "El Niño Alert",
  la_nina_watch: "La Niña Watch",
  la_nina_alert: "La Niña Alert",
};

function periodLabel(date: Date): string {
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() - 7);
  return `${start.toISOString().slice(0, 10)} → ${date.toISOString().slice(0, 10)}`;
}

function recommendedActions(national: NationalStatus): string[] {
  if (national.alert_level === "BLACK") {
    return [
      "Activate NEOC; convene NSA standing committee within 24 hours.",
      "Stand up Food, Water and Health clusters at full capacity.",
      "Authorise emergency procurement for highland provinces.",
    ];
  }
  if (national.alert_level === "RED") {
    return [
      "Issue province-level early-action advisories to focus provinces.",
      "Pre-position water and health supplies in Enga and Southern Highlands.",
      "Schedule weekly inter-agency sync until status downgrades.",
    ];
  }
  if (national.alert_level === "AMBER") {
    return [
      "Monitor ONI and rainfall anomaly weekly; flag any further escalation.",
      "Brief sector leads on contingency triggers.",
      "Verify cluster contact lists are current.",
    ];
  }
  return [
    "Routine monitoring; no operational triggers met.",
    "Maintain readiness posture and data ingestion cadence.",
  ];
}

const LEVEL_RANK: Record<RiskLevel, number> = { low: 0, med: 1, high: 2, critical: 3 };

// One row per focus province: its single worst-hit sector + how many of its
// sectors sit at HIGH or CRITICAL ("stressed"). Ranked worst-first so the report
// leads with the provinces that need attention — the same ordering the live
// Operations watch-list uses, kept deliberately in step so the printed SITREP and
// the on-screen view tell one story.
interface ProvinceRow {
  code: string;
  name: string;
  worstLevel: RiskLevel | null;
  worstSector: Sector | null;
  worstScore: number;
  stressed: number;
}

function provincialRiskRows(risk: SectorRisk[]): ProvinceRow[] {
  return Object.keys(FOCUS_NAMES)
    .map((code) => {
      const rows = risk.filter((r) => r.province_code === code);
      const worst = [...rows].sort(
        (a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || b.score - a.score,
      )[0];
      const stressed = rows.filter(
        (r) => r.level === "high" || r.level === "critical",
      ).length;
      return {
        code,
        name: FOCUS_NAMES[code],
        worstLevel: worst?.level ?? null,
        worstSector: worst?.sector ?? null,
        worstScore: worst?.score ?? 0,
        stressed,
      };
    })
    .sort(
      (a, b) =>
        (b.worstLevel ? LEVEL_RANK[b.worstLevel] : -1) -
          (a.worstLevel ? LEVEL_RANK[a.worstLevel] : -1) ||
        b.stressed - a.stressed ||
        b.worstScore - a.worstScore ||
        a.name.localeCompare(b.name),
    );
}

// Map a sector RiskLevel onto the report's alert-pill palette so the printed
// provincial table reads with the same traffic-light vocabulary as the header.
const LEVEL_PILL: Record<RiskLevel, string> = {
  low: "GREEN",
  med: "AMBER",
  high: "RED",
  critical: "BLACK",
};

function topSectorMovers(risk: SectorRisk[]): string[] {
  const rank: Record<string, number> = { low: 0, med: 1, high: 2, critical: 3 };
  const focused = risk.filter((r) => FOCUS_NAMES[r.province_code]);
  return [...focused]
    // Graduated within-band score breaks ties so the top-6 list surfaces the
    // deepest-hit cells among many sharing a level — band rank still dominates.
    .sort((a, b) => rank[b.level] - rank[a.level] || b.score - a.score)
    .slice(0, 6)
    .map(
      (r) =>
        `${FOCUS_NAMES[r.province_code]} · ${r.sector} · ${r.level.toUpperCase()} ${r.trend === "up" ? "▲" : r.trend === "down" ? "▼" : ""}`,
    );
}

export interface SitrepInputs {
  national: NationalStatus | null;
  indicators: Indicator[];
  sectorRisk: SectorRisk[];
  lastRun: LastRun | null;
  analystNote?: string;
}

export function generateSitrep(inputs: SitrepInputs): Sitrep {
  const now = new Date();
  const id = `sitrep-${now.toISOString().replace(/[:.]/g, "-")}`;
  const period = periodLabel(now);
  // Browsers name a print-to-PDF from the document <title>. Keep it clean and
  // filename-safe (no arrows/colons) so the saved file is e.g.
  // "NEWCIS SITREP 2026-06-09.pdf" rather than a mangled period string.
  const docTitle = `NEWCIS SITREP ${now.toISOString().slice(0, 10)}`;
  const national = inputs.national;
  const enso = national ? ENSO_LABEL[national.enso_phase] : "ENSO Neutral";
  const alert = national?.alert_level ?? "GREEN";
  const rating = national?.national_risk_rating.toUpperCase() ?? "LOW";

  const indicatorRows = inputs.indicators
    .map(
      (i) =>
        `<tr><td>${i.key}</td><td>${i.label}</td><td style="text-align:right">${i.value ?? "—"}</td><td>${i.unit}</td><td>${i.provenance}</td><td>${i.observed_at}</td></tr>`,
    )
    .join("\n");

  const provinceRows = provincialRiskRows(inputs.sectorRisk);
  const provincesAtRisk = provinceRows.filter(
    (p) => p.worstLevel === "high" || p.worstLevel === "critical",
  ).length;
  const provinceTableRows = provinceRows.length
    ? provinceRows
        .map((p, i) => {
          const pill = p.worstLevel
            ? `<span class="pill ${LEVEL_PILL[p.worstLevel]}">${p.worstLevel.toUpperCase()}</span>`
            : "—";
          return `<tr><td style="text-align:right">${i + 1}</td><td>${p.name} <span style="color:#a1a1aa">${p.code}</span></td><td>${pill}</td><td>${p.worstSector ?? "—"}</td><td style="text-align:right">${p.stressed || "0"}</td></tr>`;
        })
        .join("\n")
    : '<tr><td colspan="5">No focus-province sector cells available.</td></tr>';

  const movers = topSectorMovers(inputs.sectorRisk);
  const moverList = movers.length
    ? movers.map((m) => `<li>${m}</li>`).join("")
    : "<li>No focus-province sector cells available.</li>";

  const actions = national ? recommendedActions(national) : [];
  const actionList = actions.map((a) => `<li>${a}</li>`).join("");

  const sources = inputs.lastRun?.sources_ok ?? {};
  const sourceRow = Object.entries(sources)
    .map(([k, ok]) => `<span>${k}: <b>${ok ? "OK" : "FAIL"}</b></span>`)
    .join(" · ");

  const summary =
    `${alert} · ${enso} · national risk ${rating}. ` +
    (movers[0] ?? "No focus-province movers.") +
    (national?.high_risk_province_count
      ? ` ${national.high_risk_province_count} focus province(s) at high risk.`
      : "");

  const analystSection = inputs.analystNote
    ? `<section><h2>Analyst note</h2><p>${inputs.analystNote}</p></section>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${docTitle}</title>
  <style>
    body { font: 14px/1.5 -apple-system, system-ui, sans-serif; color: #18181b; max-width: 820px; margin: 32px auto; padding: 0 24px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 28px; border-bottom: 1px solid #d4d4d8; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #e4e4e7; font-size: 12px; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 12px; }
    .pill.GREEN { background: #dcfce7; color: #166534; }
    .pill.AMBER { background: #fef3c7; color: #92400e; }
    .pill.RED { background: #fee2e2; color: #991b1b; }
    .pill.BLACK { background: #0f172a; color: #ffffff; }
    ul { padding-left: 18px; }
    footer { margin-top: 32px; font-size: 11px; color: #71717a; border-top: 1px solid #e4e4e7; padding-top: 8px; }
  </style>
</head>
<body>
  <h1>NEWCIS · Weekly ENSO Situation Report</h1>
  <div>Period: <b>${period}</b> · Generated <b>${now.toISOString()}</b></div>
  <div style="margin-top:8px"><span class="pill ${alert}">${alert}</span> &nbsp; ${enso} &nbsp; · National risk: <b>${rating}</b></div>

  <section>
    <h2>Summary</h2>
    <p>${summary}</p>
  </section>

  <section>
    <h2>Key indicators</h2>
    <table>
      <thead><tr><th>Key</th><th>Label</th><th style="text-align:right">Value</th><th>Unit</th><th>Source</th><th>Observed</th></tr></thead>
      <tbody>${indicatorRows || '<tr><td colspan="6">No indicators available.</td></tr>'}</tbody>
    </table>
  </section>

  <section>
    <h2>Provincial risk</h2>
    <p style="margin:4px 0 0;color:#52525b;font-size:12px">All ${provinceRows.length} provinces ranked worst-first by their single most-stressed sector. <b>${provincesAtRisk}</b> of ${provinceRows.length} sit at HIGH or CRITICAL. "Stressed" counts how many of a province's sectors are at HIGH or CRITICAL.</p>
    <table>
      <thead><tr><th style="text-align:right">#</th><th>Province</th><th>Worst level</th><th>Worst sector</th><th style="text-align:right">Stressed</th></tr></thead>
      <tbody>${provinceTableRows}</tbody>
    </table>
  </section>

  <section>
    <h2>Focus province · sector movers</h2>
    <ul>${moverList}</ul>
  </section>

  <section>
    <h2>Recommended actions</h2>
    <ul>${actionList || "<li>—</li>"}</ul>
  </section>

  ${analystSection}

  <footer>
    Data sources this cycle: ${sourceRow || "—"}.<br />
    NEWCIS proof-of-concept · newcis.in4metrix.dev · Generated automatically from current /data state.
  </footer>
</body>
</html>`;

  return {
    id,
    period,
    generated_at: now.toISOString(),
    html,
    summary,
    analyst_note: inputs.analystNote,
  };
}
