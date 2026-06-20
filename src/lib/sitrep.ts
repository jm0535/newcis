// Weekly SITREP generator. Pure-ish (one new Date()) — given current data it
// produces a templated HTML report following the NEWCIS concept's SITREP
// structure: status, indicators, provincial risk, sector highlights, actions.
//
// HTML is intentionally print-stylesheet-friendly: a B&W document is the
// fallback artefact at PoC scale.
import type {
  HistoricalReading,
  Indicator,
  LastRun,
  NationalStatus,
  ProvinceFC,
  RiskLevel,
  Sector,
  SectorRisk,
  Sitrep,
  SitrepModel,
} from "./types";
import {
  kpiBandSvg,
  riskMatrixSvg,
  trendChartSvg,
  provincialMapSvg,
} from "./sitrep-visuals";
import type { WefInsight } from "./wef";
import { FOCUS_NAMES } from "./focus-provinces";
import { bottomLineSentence } from "./national-language";
import { dataConfidence } from "./data-confidence";
import {
  provincialRiskCaption,
  selectStrategicContext,
  STRATEGIC_INTRO,
} from "./sitrep-shared";
import {
  CLASSIFICATION,
  DISTRIBUTION,
  ISSUING_AUTHORITY,
  actionsLeadPara,
  climateAssessmentPara,
  conclusionPara,
  executiveSummary,
  introductionParas,
  provincialAssessmentPara,
  sectoralImpactPara,
  situationOverviewPara,
} from "./sitrep-prose";
import { SITREP_CSS } from "./sitrep-styles";

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
  /** WEF strategic-intelligence tiles (DEMO). Relevance-filtered into the report. */
  wefInsights?: WefInsight[];
  analystNote?: string;
  /** 12-month indicator history, for the trend small-multiples. */
  history?: HistoricalReading[];
  /** Province geometry (public/provinces.geojson), for the provincial map. */
  geojson?: ProvinceFC;
}

export interface SitrepVisuals {
  national: NationalStatus | null;
  indicators?: Indicator[];
  sectorRisk: SectorRisk[];
  history: HistoricalReading[];
  geojson: ProvinceFC;
}

// Pure: current data → structured model. No I/O, no formatting decisions beyond
// shaping values into display strings.
export function buildSitrepModel(inputs: SitrepInputs): SitrepModel {
  const now = new Date();
  const id = `sitrep-${now.toISOString().replace(/[:.]/g, "-")}`;
  const period = periodLabel(now);
  const docTitle = `NEWCIS SITREP ${now.toISOString().slice(0, 10)}`;
  const national = inputs.national;
  const enso = national ? ENSO_LABEL[national.enso_phase] : "ENSO Neutral";
  const alert = national?.alert_level ?? "GREEN";
  const rating = national?.national_risk_rating.toUpperCase() ?? "LOW";

  const indicators = inputs.indicators.map((i) => ({
    key: i.key,
    label: i.label,
    value: i.value === null || i.value === undefined ? "—" : String(i.value),
    unit: i.unit,
    provenance: i.provenance,
    observedAt: i.observed_at,
  }));

  const rows = provincialRiskRows(inputs.sectorRisk);
  const provinces = rows.map((p, i) => ({
    rank: i + 1,
    name: p.name,
    code: p.code,
    level: p.worstLevel ? p.worstLevel.toUpperCase() : "—",
    sector: p.worstSector ?? "—",
    stressed: p.stressed,
  }));
  const provincesAtRisk = rows.filter(
    (p) => p.worstLevel === "high" || p.worstLevel === "critical",
  ).length;

  const movers = topSectorMovers(inputs.sectorRisk);
  const actions = national ? recommendedActions(national) : [];
  const strategic = selectStrategicContext(
    inputs.wefInsights ?? [],
    inputs.sectorRisk,
  );
  const sources = Object.entries(inputs.lastRun?.sources_ok ?? {}).map(([name, ok]) => ({
    name,
    ok,
  }));

  const bottomLine = national ? bottomLineSentence(national) : "";
  const confidence = dataConfidence(inputs.lastRun);

  const summary =
    `${alert} · ${enso} · national risk ${rating}. ` +
    (movers[0] ?? "No focus-province movers.") +
    (national?.high_risk_province_count
      ? ` ${national.high_risk_province_count} focus province(s) at high risk.`
      : "");

  return {
    id,
    generatedAt: now.toISOString(),
    period,
    docTitle,
    enso,
    alert,
    rating,
    summary,
    indicators,
    provinces,
    provinceCount: rows.length,
    provincesAtRisk,
    movers,
    actions,
    bottomLine,
    confidence,
    strategic,
    sources,
    analystNote: inputs.analystNote,
  };
}

// Escape user/text content destined for the HTML report so an analyst note (free
// text) can never inject markup.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderSitrepHtml(m: SitrepModel, v: SitrepVisuals): string {
  const kpiSvg = kpiBandSvg(v.national);
  const matrixSvg = riskMatrixSvg(v.sectorRisk);
  const trendsSvg = trendChartSvg(v.history, v.indicators ?? []);
  const mapSvg = provincialMapSvg(v.geojson, v.sectorRisk);

  const indicatorRows = m.indicators
    .map(
      (i) =>
        `<tr><td>${esc(i.key)}</td><td>${esc(i.label)}</td><td style="text-align:right">${esc(i.value)}</td><td>${esc(i.unit)}</td><td>${esc(i.provenance)}</td><td>${esc(i.observedAt)}</td></tr>`,
    )
    .join("\n");

  const provinceTableRows = m.provinces.length
    ? m.provinces
        .map((p) => {
          const pill =
            p.level !== "—"
              ? `<span class="pill ${LEVEL_PILL[p.level.toLowerCase() as RiskLevel] ?? "GREEN"}">${p.level}</span>`
              : "—";
          return `<tr><td style="text-align:right">${p.rank}</td><td>${esc(p.name)} <span style="color:#a1a1aa">${esc(p.code)}</span></td><td>${pill}</td><td>${esc(p.sector)}</td><td style="text-align:right">${p.stressed || "0"}</td></tr>`;
        })
        .join("\n")
    : '<tr><td colspan="5">No focus-province sector cells available.</td></tr>';

  const moverList = m.movers.length
    ? m.movers.map((mv) => `<li>${esc(mv)}</li>`).join("")
    : "<li>No focus-province sector cells available.</li>";

  const actionList = m.actions.map((a) => `<li>${esc(a)}</li>`).join("");

  // Strategic context (WEF). Each item is a card: plain headline + scope + DEMO
  // badge, the paraphrase, a "why it matters here" line, and the public source
  // link. Written so a non-technical reader gets the point without the graph.
  const strategicSection = m.strategic.length
    ? `<section>
    <h2>6 · Strategic context · World Economic Forum</h2>
    <p style="margin:4px 0 12px;color:#52525b;font-size:12px">${esc(STRATEGIC_INTRO)}</p>
    ${m.strategic
      .map(
        (s) => `<div style="border:1px solid #e4e4e7;border-radius:6px;padding:10px 12px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">
        <b style="font-size:13px">${esc(s.title)}</b>
        <span style="white-space:nowrap;font-size:11px;color:#71717a">${esc(s.scope)} · <span class="pill DEMO">${esc(s.provenance)}</span></span>
      </div>
      <p style="margin:6px 0 4px;font-size:12px">${esc(s.summary)}</p>
      <p style="margin:0 0 6px;font-size:12px;color:#3f3f46"><b>Why it matters here:</b> ${esc(s.relevance)}</p>
      <div style="font-size:11px;color:#71717a">${esc(s.source)} · ${esc(s.published)} · <a href="${esc(s.url)}">${esc(s.url)}</a></div>
    </div>`,
      )
      .join("\n")}
  </section>`
    : "";

  // Sequential figure/table numbering. A government report cross-references its
  // exhibits ("see Figure 2"), so each visual and data table carries a numbered,
  // captioned label. These counters increment in document order as the body is
  // assembled below.
  let figNo = 0;
  let tblNo = 0;
  const figure = (svg: string, caption: string): string =>
    `<figure>${svg}<figcaption><b>Figure ${++figNo}.</b> ${esc(caption)}</figcaption></figure>`;
  const tableCaption = (caption: string): string =>
    `<p class="tcaption"><b>Table ${++tblNo}.</b> ${esc(caption)}</p>`;

  const confBadgeColor =
    m.confidence.level === "GOOD" ? "#166534" : m.confidence.level === "PARTIAL" ? "#92400e" : "#991b1b";
  const confBadgeBg =
    m.confidence.level === "GOOD" ? "#dcfce7" : m.confidence.level === "PARTIAL" ? "#fef3c7" : "#fee2e2";

  const appendixFeedRows = m.confidence.feeds.length
    ? m.confidence.feeds
        .map((f) => `<tr><td>${esc(f.name)}</td><td><b>${f.ok ? "OK" : "FAIL"}</b></td></tr>`)
        .join("")
    : '<tr><td colspan="2">No ingest run reported this cycle.</td></tr>';

  const analystSection = m.analystNote
    ? `<section><h2>9 · Analyst note</h2><p>${esc(m.analystNote)}</p></section>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${m.docTitle}</title>
  <style>${SITREP_CSS}</style>
</head>
<body>
  <div class="classification">${esc(CLASSIFICATION)}</div>

  <header class="titleblock">
    <h1>Weekly ENSO Situation Report</h1>
    <div class="subtitle">National ENSO Early Warning &amp; Climate Intelligence System (NEWCIS)</div>
    <table class="meta">
      <tr><td>Issuing authority</td><td>${esc(ISSUING_AUTHORITY)}</td></tr>
      <tr><td>Reporting period</td><td><b>${esc(m.period)}</b></td></tr>
      <tr><td>Report reference</td><td>${esc(m.id)}</td></tr>
      <tr><td>Date generated</td><td>${esc(m.generatedAt)}</td></tr>
      <tr><td>Alert level</td><td><b>${esc(m.alert)}</b> · ${esc(m.enso)} · national risk ${esc(m.rating)}</td></tr>
      <tr><td>Distribution</td><td>${esc(DISTRIBUTION)}</td></tr>
      <tr><td>Data confidence</td><td><span class="badge" style="background:${confBadgeBg};color:${confBadgeColor}">${m.confidence.level}</span></td></tr>
    </table>
  </header>

  <section>
    <h2>Executive summary</h2>
    <div class="bottomline">${esc(executiveSummary(m))}</div>
  </section>

  <section>
    <h2>1 · Introduction</h2>
    ${introductionParas(m).map((p) => `<p>${esc(p)}</p>`).join("\n    ")}
  </section>

  <section>
    <h2>2 · Situation overview</h2>
    <p>${esc(situationOverviewPara(m))}</p>
    ${figure(kpiSvg, "National key indicators — ENSO phase, alert level, risk rating, affected population, high-risk provinces and forecast period.")}
  </section>

  <section>
    <h2>3 · Climate &amp; ENSO assessment</h2>
    <p>${esc(climateAssessmentPara(m))}</p>
    ${figure(trendsSvg, "Recent trend per climate indicator, with the latest value and unit on each chart.")}
    ${tableCaption("Climate indicators this cycle, with value, unit, provenance (LIVE/DEMO) and observation date.")}
    <table>
      <thead><tr><th>Key</th><th>Label</th><th style="text-align:right">Value</th><th>Unit</th><th>Source</th><th>Observed</th></tr></thead>
      <tbody>${indicatorRows || '<tr><td colspan="6">No indicators available.</td></tr>'}</tbody>
    </table>
  </section>

  <section>
    <h2>4 · Provincial risk assessment</h2>
    <p>${esc(provincialAssessmentPara(m))}</p>
    ${figure(mapSvg, "Provincial risk map — each province coloured by its single worst-hit sector.")}
    ${figure(matrixSvg, "National risk matrix — all sectors (rows) against all provinces (columns), traffic-light coded.")}
    ${tableCaption(provincialRiskCaption(m.provinceCount, m.provincesAtRisk))}
    <table>
      <thead><tr><th style="text-align:right">#</th><th>Province</th><th>Worst level</th><th>Worst sector</th><th style="text-align:right">Stressed</th></tr></thead>
      <tbody>${provinceTableRows}</tbody>
    </table>
  </section>

  <section>
    <h2>5 · Sectoral impact</h2>
    <p>${esc(sectoralImpactPara(m))}</p>
    <ul>${moverList}</ul>
  </section>

  ${strategicSection}

  <section>
    <h2>7 · Recommended actions</h2>
    <p>${esc(actionsLeadPara(m))}</p>
    <ul>${actionList || "<li>—</li>"}</ul>
  </section>

  <section>
    <h2>8 · Conclusion</h2>
    <p>${esc(conclusionPara(m))}</p>
  </section>

  ${analystSection}

  <section class="appendix">
    <h2>Annex A · Technical appendix</h2>
    <p class="muted">For data and operations staff. ${esc(m.confidence.line)}</p>
    ${tableCaption("Status of each data feed for this ingest cycle.")}
    <table>
      <thead><tr><th>Data feed</th><th>Status this cycle</th></tr></thead>
      <tbody>${appendixFeedRows}</tbody>
    </table>
    <p class="muted">NEWCIS proof-of-concept · newcis.in4metrix.dev · Generated from a point-in-time data snapshot. Figures marked DEMO are seeded references, not live feeds.</p>
  </section>

  <div class="classification">${esc(CLASSIFICATION)}</div>
</body>
</html>`;
}

// Generate a complete, persistable report. The structured model is stored
// alongside the HTML so an editable .docx download (see /api/sitrep/[id]/docx)
// can reproduce the same point-in-time snapshot.
export function generateSitrep(inputs: SitrepInputs): Sitrep {
  const model = buildSitrepModel(inputs);
  const html = renderSitrepHtml(model, {
    national: inputs.national,
    indicators: inputs.indicators,
    sectorRisk: inputs.sectorRisk,
    history: inputs.history ?? [],
    geojson: inputs.geojson ?? { type: "FeatureCollection", features: [] },
  });
  return {
    id: model.id,
    period: model.period,
    generated_at: model.generatedAt,
    html,
    summary: model.summary,
    analyst_note: inputs.analystNote,
    model,
  };
}
