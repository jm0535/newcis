# Professional Government SITREP — Design Spec

**Date:** 2026-06-20
**Status:** Approved for planning
**Scope:** Single feature — upgrade the Weekly SITREP (HTML + .docx) to a government-grade report.

---

## 0. Problem

The current SITREP is text/table only. Three concrete failures (reported with dashboard screenshots):

1. **Engineer jargon at the footer.** The report ends with a raw feed-health dump — `noaa_oni: FAIL · noaa_soi: OK · …`. Non-technical officers and executives cannot parse this; it sits where a conclusion should.
2. **Executive Strategic Overview missing.** The dashboard leads with a KPI band (ENSO phase, National Alert, National Risk, Affected Population, High-Risk Provinces, Forecast Period) and a one-line Bottom Line. None of this is in the SITREP.
3. **No visuals.** No risk matrix, no trend graphs, no map. A government report needs the operating picture as pictures, not just tables.

## 1. Goal

A professionally formatted Weekly SITREP, in **both** standalone print-HTML and editable **.docx**, that:
- Leads with the executive picture (KPI band + Bottom Line + data-confidence).
- Carries four visuals: Executive KPI band, National Risk Matrix, Indicator trend graphs, Provincial risk map.
- Speaks plain English to non-technical readers; keeps the engineer audit trail in a clearly-labelled Technical appendix.
- Never drifts between the HTML view and the Word document (one model, shared builders).
- Honours the NEWCIS honesty contract: DEMO is never shown as LIVE.

## 2. Constraint that drives the architecture

The SITREP renders **two ways**: a standalone HTML document (opened in a new tab, print-to-PDF) and an editable `.docx`. The dashboard's visuals (`RiskMatrix.tsx`, `TrendChart.tsx`, `HeatMap`, `KpiStrip.tsx`, `ExecutiveHeadline.tsx`) are **React/client components** — they cannot be used in standalone HTML or in Word.

Therefore every visual must be built as a **server-side SVG string** (no React, no DOM, no browser):
- **HTML report** embeds the SVG string inline — crisp, print-perfect.
- **.docx report** rasterizes each SVG → PNG and embeds the PNG — reliable in every Word version, including older government installs (chosen over native SVG-in-Word, which fails on Word < 2016).

Rasterizer: **`@resvg/resvg-js`** — native/WASM, no system libraries, Vercel-serverless-safe. Added as a dependency.

## 3. New modules

### 3.1 `src/lib/national-language.ts` (pure)
The plain-language vocabulary the dashboard already uses lives inside React components (`ExecutiveHeadline.tsx`, `KpiStrip.tsx`) and so cannot be reused by the server-rendered SITREP. Extract it to one pure module, imported by BOTH the dashboard components and the SITREP. One source of truth, zero drift.

Exports:
- `PHASE_PLAIN: Record<NationalStatus["enso_phase"], string>` — moved verbatim from `ExecutiveHeadline.tsx`.
- `ALERT_ACTION: Record<AlertLevel, string>` — the `ACTION` map, moved verbatim.
- `bottomLineSentence(national: NationalStatus): string` — the exact sentence `ExecutiveHeadline` builds today (phase + alert + risk + stressed-province clause), extracted so SITREP prints the identical Bottom Line.
- `KPI_SUBLABEL: Record<string, string>` — the small grey explainer under each KPI card (e.g. ENSO → "Pacific in a normal state…"). Sourced from `KpiStrip.tsx`.

`ExecutiveHeadline.tsx` and `KpiStrip.tsx` are refactored to import these — **render output must stay byte-identical** (verified by eye + existing behaviour; these components have no tests today, so the refactor is conservative — move constants, keep JSX).

### 3.2 `src/lib/data-confidence.ts` (pure)
- `dataConfidence(lastRun: LastRun | null): { level: "GOOD" | "PARTIAL" | "LOW"; line: string; feeds: { name: string; ok: boolean }[] }`
- `level` from share of `sources_ok` true: ≥0.75 GOOD, ≥0.4 PARTIAL, else LOW. Null lastRun → LOW.
- `line` plain English: `"8 of 13 data feeds reported this cycle. Figures marked DEMO are seeded references shown pending a live feed."`
- `feeds` is the raw OK/FAIL list, surfaced ONLY in the Technical appendix.

### 3.3 `src/lib/sitrep-visuals.ts` (pure SVG builders)
Each function: data in → SVG string out. Fixed `viewBox`, light-mode print palette, **inline `style`/attributes only** (no external CSS — survives standalone HTML and rasterization). Deterministic.

- `kpiBandSvg(national: NationalStatus | null): string`
  6 cells in a row (wraps to 2×3 on the SVG canvas): ENSO phase, National Alert (cell fill = traffic-light), National Risk, Affected Population (thousands-grouped), High-Risk Provinces, Forecast Period. Each cell: label (small caps), big value, plain sublabel from `KPI_SUBLABEL`. ViewBox ~960×200. Null national → a single "No national status this cycle" cell.

- `riskMatrixSvg(sectorRisk: SectorRisk[]): string`
  Rows = the 7 sectors (fixed order). Columns = a leading **National** column (sector's worst level across focus provinces + count) then the focus provinces (`FOCUS_CODES`, short labels from `FOCUS_SHORT_LABELS`). Each cell: traffic-light fill (LOW/MED/HIGH/CRITICAL via `RISK_COLOUR`) + trend glyph (▲▼ / — ). Header row rotated province labels. Legend strip below (4 swatches + meaning). ViewBox width scales with column count. Empty data → a "No sector cells this cycle" note.

- `trendChartSvg(history: HistoricalReading[], indicators: Indicator[]): string`
  Small-multiples grid (3 across): one mini line chart per key indicator present in BOTH `indicators` and `history` (ONI, RAINFALL_ANOM, SST_ANOM, TEMP_ANOM, SOI, SOIL_MOISTURE, NDVI — whichever exist). Each: last ≤12 readings for that `key` sorted by `observed_at`, a zero baseline, min/max auto-scaled, latest value labelled, indicator label as title. Skip indicators with <2 points. ViewBox grows by row count.

- `provincialMapSvg(geojson: ProvinceFC, sectorRisk: SectorRisk[]): string`
  Project all 22 province MultiPolygons to SVG paths via a linear lon/lat → viewBox fit (compute bbox over all coords, scale to fit ~760×620 with margin, flip Y). Each province filled by its **worst** sector level (join `sectorRisk` on `province_code`, max of LOW/MED/HIGH/CRITICAL); provinces with no risk data → neutral grey. Thin white strokes. Title + the same 4-swatch legend. `ProvinceFC` is a minimal local GeoJSON type (FeatureCollection of MultiPolygon with `{code,name,is_focus,population}` properties) — no new geo dependency.

**File-size guard:** if `sitrep-visuals.ts` exceeds 500 lines, split into `src/lib/sitrep-visuals/{kpi,matrix,trends,map,shared}.ts` with a barrel `index.ts`. Decide at build time. Shared SVG helpers (escape, palette, number format, the legend strip) live in a `shared` section/file so the four builders stay DRY.

### 3.4 `src/lib/sitrep-raster.ts` (impure — Node only)
- `svgToPng(svg: string, width: number): Promise<Buffer>` — wraps `@resvg/resvg-js`. Used only by the docx renderer. Isolated so the pure builders stay testable without the native module.

## 4. Render wiring + data flow

### 4.1 Inputs
`SitrepInputs` (in `sitrep.ts`) gains:
- `history?: HistoricalReading[]`
- `geojson?: ProvinceFC`

(`wefInsights?` already added in the prior change. `national`, `indicators`, `sectorRisk`, `lastRun` already present.)

### 4.2 Model
`SitrepModel` stays **lean** — it does NOT store the large SVG strings (the persisted `/data/sitreps/*.json` must not balloon). Instead the model stores the structured inputs the visuals need, which it already largely has:
- Add `confidence: { level: string; line: string; feeds: { name: string; ok: boolean }[] }` (from `dataConfidence`).
- Add `bottomLine: string` (from `bottomLineSentence`, or `""` when national is null).
- Add `kpis: { enso; alert; rating; population; highRisk; forecast }` plain display strings for the KPI band fallback/text.
- Keep `history` + a flag for whether geojson was available, so a rebuilt-from-model docx (the `[id]/docx` fallback) can still draw. Where the stored model predates these fields, renderers skip the visual gracefully.

The **SVG builders are called at render time** by both renderers (they receive the raw `national/sectorRisk/history/geojson`, threaded into the render functions), not stored in the model.

### 4.3 HTML renderer (`sitrep.ts → renderSitrepHtml`)
Signature gains a second argument carrying the raw visual inputs: `renderSitrepHtml(model, visuals)` where `visuals = { national, sectorRisk, history, geojson }`. The function calls the four SVG builders with these inputs and injects the resulting inline `<svg>` blocks in the exec-first order. Add print CSS for the new sections + the data-confidence badge + the `.appendix` styling (small, muted).

### 4.4 Docx renderer (`sitrep-docx.ts → buildSitrepDocx`)
Already `async`. For each visual: build SVG → `svgToPng` → `ImageRun` in the document at the matching section. KPI band may ALSO be a native Word table (more editable) — **decision: KPI band = PNG image for visual fidelity + a compact native table beneath it for editability**; matrix/trends/map = PNG images. Provincial risk detail table (already native) stays native.

### 4.5 Section order (exec-first), both formats
1. Title + Period/Generated + **Data confidence badge**
2. **Executive KPI band** (visual)
3. **Bottom Line** (one sentence + recommended action clause)
4. Summary
5. **National Risk Matrix** (visual)
6. **Provincial risk map** (visual)
7. Provincial risk table (existing)
8. **Indicator trends** (visual)
9. Focus province · sector movers (existing)
10. Recommended actions (existing)
11. Strategic context · World Economic Forum (existing)
12. Analyst note (existing)
13. **Technical appendix** — data-confidence line + raw feed OK/FAIL table + provenance note. Replaces the old footer dump.

### 4.6 Routes
All three SITREP routes load and pass `history` + `geojson`:
- `POST /api/sitrep` (HTML generate + persist)
- `POST /api/sitrep/docx` (one-shot docx)
- `GET /api/sitrep/[id]/docx` (stored; on model-present path it draws from stored structured data + re-reads geojson/history for the visuals, since those are static/cheap)

geojson is read once from `public/provinces.geojson` via a small `getProvincesGeojson()` helper in `data.ts` (server fs read, typed as `ProvinceFC`).

## 5. Testing (TDD)

- `national-language.test.ts` — `bottomLineSentence` reproduces the known dashboard sentence for GREEN/AMBER/RED/BLACK + stressed-province clause.
- `data-confidence.test.ts` — level thresholds (GOOD/PARTIAL/LOW), null lastRun → LOW, line text + feed list.
- `sitrep-visuals.test.ts` — for a fixed scenario each builder returns a non-empty `<svg …>`; matrix SVG contains a cell fill for a CRITICAL sector; map SVG contains 22 `<path`; trends SVG skips an indicator with <2 points; kpi SVG contains the alert level text. (Assert on substrings/structure, not pixels.)
- `sitrep.test.ts` (extend) — HTML report contains the KPI band, Bottom Line sentence, matrix svg, map svg, trends svg, the Technical appendix heading, and does NOT contain a raw `feed: FAIL` line outside the appendix.
- Docx: a smoke test that `buildSitrepDocx` resolves to a non-empty Buffer with visuals present (PNG embed path exercised). `@resvg/resvg-js` runs in the Node test env.
- Existing strategic-context + escaping tests stay green.

## 6. Honesty contract

- DEMO indicators/sectors keep DEMO badging in tables and the data-confidence line ("Figures marked DEMO are seeded references").
- The map/matrix colour a cell by its computed level regardless of provenance, but the provincial/sector tables continue to show the provenance badge so a reader can tell live from seeded.
- No feed is labelled LIVE that did not report.

## 7. Out of scope (YAGNI)

- Interactive/clickable visuals (the report is print/Word — static only).
- Per-province drill pages in the report.
- Historical-scenario comparison strip (separate feature).
- Re-theming the dashboard.

## 8. File-budget watch

Touch points: `national-language.ts` (new), `data-confidence.ts` (new), `sitrep-visuals.ts` (new, split if >500), `sitrep-raster.ts` (new), `sitrep.ts` (grows — currently 369; if it crosses 500 after the new sections, extract the HTML section-builders to `sitrep-html.ts`), `sitrep-docx.ts` (grows — currently 311; same rule, extract helpers if needed), `types.ts`, `data.ts`, 3 routes, `ExecutiveHeadline.tsx` + `KpiStrip.tsx` (shrink — import shared module).
