# NEWCIS — Proof of Concept

> **National ENSO Early Warning and Climate Intelligence System**
> Proof-of-concept prototype. Papua New Guinea.
> This file is the single source of truth for the build. Read it fully before writing code.

---

## 0. What this PoC is (and is not)

NEWCIS is, architecturally, a **three-tier data-to-decision pipeline**:

```
INGEST (external + national feeds) → INTELLIGENCE (risk engine, traffic-light) → PRESENT (dashboard + SITREP)
```

The **production** system is specified as Microsoft Power BI + ArcGIS Enterprise. **This PoC deliberately does not use either.** It proves the *pipeline and the logic* with open web tooling, designed so each layer maps cleanly onto the production stack later.

### This PoC IS
- A **full thin slice**: real data flows through real risk logic into a credible executive operating picture.
- Narrow in breadth (4 focus provinces, ~7 climate indicators, the core sectoral panels, one SITREP), **never shallow in depth** — every layer genuinely works.
- Demo-ready for **two audiences at once**: a technical team validating feasibility, and NSA/executive decision-makers seeing the vision.

### This PoC IS NOT
- Not full 22-province coverage (the engine must be province-agnostic, but seed only the focus set).
- Not AI forecasting (that is production Phase 3).
- Not authenticated/role-secured (single public read-only view for the demo).
- Not connected to live PNG agency systems (those have no public APIs — see §4).
- Not a real ArcGIS deployment (use open web maps; defer ArcGIS to production).

### The credibility rule (non-negotiable)
Every data element on screen carries a **provenance badge**: `LIVE` (pulled from a real API this cycle) or `DEMO` (seeded placeholder). Never blur the two. This is what lets the prototype satisfy both audiences honestly.

---

## 1. Stack (locked)

| Layer | PoC implementation | Maps to production |
|---|---|---|
| Frontend | **Next.js (App Router)** on **Vercel**, at `newcis.in4metrix.dev`. Design system: semantic CSS tokens + UI primitives in `src/components/ui/`, Inter + JetBrains Mono, lucide-react, framer-motion, dark/light themes. See `docs/design-system.md` (§11). | Power BI Service |
| Ingestion | **GitHub Actions** scheduled workflow (Node/TS) → commits JSON to the repo | Power Automate / Data Factory |
| Storage | **Versioned JSON files in the repo** (`/data/*.json`); province geometry as static GeoJSON in `/public` | SQL Server |
| Risk engine | TypeScript module; thresholds in a config file | Power BI DAX measures |
| Read API | Next.js reads the JSON files directly (static import / `/public` fetch) | Power BI dataset / REST |
| Map | **MapLibre GL** (or Leaflet) + static province GeoJSON | ArcGIS Maps for Power BI |
| Charts | Recharts (gauges, trend lines) | Power BI visuals |
| Reporting | Server route renders SITREP → HTML, print-to-PDF | Power Automate |
| Repo / CI | **GitHub** → Vercel auto-deploy (a data commit redeploys) | — |

> **No database in this PoC.** Storage is deferred — Supabase/Postgres is a Phase-2 step, and the real production target is SQL Server. The data model in §3 is defined as JSON shapes so a database can later be swapped in without a rewrite.

### Critical architecture decision: ingestion ≠ presentation
Ingestion runs in **GitHub Actions on a cron schedule**, NOT in Vercel Cron or serverless functions.
**Why:** Vercel functions time out (10–60s); some NOAA/NASA endpoints are slow or paginated. The Action does the slow pulls, computes risk, and **commits the resulting JSON files back to the repo**. The commit triggers a Vercel redeploy, and **Vercel only ever reads static files** — so the executive demo is always fast and never blocks on an upstream API. This separation mirrors the production decoupling of data pipeline from dashboard.

**Bonus from git-as-store:** every ingest cycle is a commit, so git history *is* the audit trail (it replaces a dedicated runs table). Fine at a 6-hourly cadence; this pattern is not for high-frequency writes, which is exactly why a real DB returns in Phase 2.

---

## 2. Focus scope for the slice

**Focus provinces** (from the concept's high-risk list):
`Enga`, `Western Highlands`, `Southern Highlands`, `Gulf`.
Seed all PNG provinces in the boundary layer (greyed), but only compute/show risk for these four.

**Climate indicators (Page 2 core):**
ONI, SOI, SST anomaly, rainfall anomaly, temperature anomaly, soil moisture, NDVI vegetation health.

**Sectors (Page 3):**
Food Security, Water Security, Public Health, Economic Stability, Infrastructure, Energy Security, Social Stability.

**Traffic-light system (the spine):**
`GREEN` (routine) → `AMBER` (ENSO watch) → `RED` (ENSO alert) → `BLACK` (national emergency).

---

## 3. Data model (file-based JSON)

Keep it small and explicit. Storage is a set of JSON files the ingestion Action writes and the app reads. Shapes are defined as TypeScript-style interfaces so a database can replace them later without changing the app's read code.

**Files:**
- `/public/provinces.geojson` — PNG admin-1 boundaries (static, loaded once). Each feature's `properties` carries `code` (p-code), `name`, `is_focus` (bool), `population`.
- `/data/indicators.json` — array of `{ key, label, unit, source, update_frequency, provenance, value, observed_at, trend }` where `provenance` is `'LIVE' | 'DEMO'` and `trend` is `'up' | 'down' | 'flat'`. (Latest reading per indicator; this is the working set the dashboard shows.)
- `/data/readings_history.json` — append-only array of `{ key, value, observed_at }` for the 12-month trend lines.
- `/data/risk_thresholds.json` — `{ metric, green_max, amber_max, red_max }[]` (drives traffic-light; edit this file to retune, no code change).
- `/data/sector_risk.json` — `{ province_code, sector, level, score, trend, provenance, as_of }[]` where `level` is `'low' | 'med' | 'high' | 'critical'`.
- `/data/national_status.json` — single object: `{ enso_phase, alert_level, national_risk_rating, affected_population_est, high_risk_province_count, forecast_period, updated_at }`.
- `/data/sitreps/` — one file per generated SITREP: `{ id, period, generated_at, html, summary }`.
- `/data/last_run.json` — `{ started_at, finished_at, status, sources_ok: Record<string,boolean>, notes }`. Powers the "last updated" timestamp + data-health badge. (Git history is the deeper audit trail.)

> No PostGIS. The four focus provinces are coloured client-side by MapLibre from `sector_risk.json` joined to the GeoJSON on `code`. Spatial queries weren't needed for a 4-province map.

---

## 4. Data sources — what's real vs mock

### Climate / ENSO indicators — REAL (this is the technical credibility core)
- **ONI, ENSO outlook, SST** — NOAA Climate Prediction Center (CPC) text/JSON products + NOAA Coral Reef Watch.
- **SOI** — Australian BoM.
- **NDVI, soil moisture** — NASA (MODIS / SMAP). For PoC, a national/regional aggregate is fine; full raster tiling is production.
- **Agricultural stress (ASI)** — **FAO GIEWS Earth Observation / ASIS** `asis/data/country/PNG/.../ASI_Dekad_Season1_data.csv`. Keyless per-country CSV, the only global source giving PNG at **admin-1 (province)** level. Dekadal (10-day). Feeds the `ASI` indicator + per-province Food Security rows. `LIVE`. (Pre-2012 borders: Hela/Jiwaka inherit their parent highland's ASI, stated in the row.)
- **Rainfall / temperature anomalies** — start from NOAA/global products; PNGNWS has no public API, so label PNGNWS-specific feeds `DEMO` until a feed exists.

> Pull what is genuinely automatable now; for any indicator without a clean free endpoint, seed a realistic value and mark it `DEMO`. **Do not fake a `LIVE` badge.**

### Sectoral data — HYBRID
PNG national agencies (DAL, Health, Water PNG, Treasury) have **no public live APIs**. Use aggregators that already collect PNG data programmatically:

| Sector | Source | Access | Granularity | PoC badge |
|---|---|---|---|---|
| Food security (IPC phase) | **HDX HAPI** `food-security-nutrition-poverty/food-security` | app-identifier, no account | Admin 1 (province) | `LIVE` |
| Food prices | **HDX HAPI** `food-prices-market-monitor` (WFP VAM) | app-identifier | market | `LIVE` |
| Social stability | **HDX HAPI** `coordination-context/conflict-events` (ACLED) | app-identifier | Admin 1/2 | `LIVE` |
| Displacement | **HDX HAPI** (IOM DTM) | app-identifier | Admin 1/2 | `LIVE` |
| Rainfall hazard | **HDX HAPI** `climate/hazards-rainfall` | app-identifier | subnational | `LIVE` |
| Water / Health / Energy / Infrastructure | none clean | — | — | `DEMO` (seeded) |

**HDX HAPI usage:**
- Endpoint pattern: `https://hapi.humdata.org/api/v1/{THEME}?output_format=json&location_code=PNG&admin1_code={PCODE}&app_identifier={APP_ID}`
- No account needed; generate an `app_identifier` once via the API and store it as a GitHub Actions secret (`HDX_APP_ID`).
- PNG admin1 p-codes come from HAPI's own admin1 metadata endpoint — fetch and bake them into the `code` property of each GeoJSON feature so sectoral data joins cleanly to geometry.

### Province geometry — OPEN DATA
Use **GADM** (admin level 1) or **OCHA/HDX Common Operational Dataset** PNG admin boundaries (the latter is preferred — its p-codes match HDX HAPI, so food-security data joins cleanly to geometry). Simplify polygons for web (`mapshaper`) and save the result as the static `/public/provinces.geojson` — loaded once by the map, never re-fetched.

---

## 5. Risk engine (the analytical core)

A pure, deterministic, testable TypeScript module. No side effects — inputs in, risk out.

**Responsibilities:**
1. **Indicator → alert level.** Compare each climate reading to `risk_thresholds.json` → Green/Amber/Red/Black. ONI bands are the primary ENSO driver (e.g. El Niño watch/alert thresholds); make every band config-driven, not hardcoded.
2. **Sector risk.** Combine relevant indicators + sectoral data into a `low/med/high/critical` level per province per sector. Document the formula in code comments; keep it simple and explainable (executives will ask "why is Enga red?").
3. **National rollup.** Derive `national_status.json` (overall alert level, risk rating, high-risk province count, affected-population estimate) from province/sector results.
4. **Trend.** Compare to the previous reading in `readings_history.json` → up/down/flat.

**Rules:**
- Thresholds live in `risk_thresholds.json`, never inline.
- The engine must run on partial data (some sources may fail a cycle) and flag what's missing rather than crash.
- Unit-test the engine against fixed fixtures (a known El Niño scenario should produce RED). This is what convinces the technical audience.

---

## 6. Frontend — the operating picture

Mirror the concept's four executive pages, condensed for the slice. Design for a **large operations-centre display** (the concept's intended context) — high-contrast, glanceable, traffic-light coded.

- **Page 1 — Executive Strategic Overview**
  Header KPI cards (ENSO status, national alert level, risk rating, affected population, # high-risk provinces, forecast period). National risk matrix (7 sectors, traffic-light + trend arrows). **Provincial heat map** (MapLibre, focus provinces coloured by overall risk, click → province detail).
- **Page 2 — ENSO Climate Intelligence**
  Live indicators as gauges + 12-month trend lines. Historical comparison strip (1997–98, 2015–16, 2023–24, current). Early-warning threshold panel.
- **Page 3 — Sectoral Impact**
  Panels per sector with lead-agency labels, each carrying `LIVE`/`DEMO` provenance badges.
- **Page 4 — Intelligence & Operations**
  National situation summary, high-risk province list, cluster status board (static/seeded for PoC), action tracker (seeded), and the **SITREP generator** button.

**Global UI requirements**
- A persistent **status bar**: ENSO status, alert traffic-light, "data last updated" timestamp (from `last_run.json`), and a data-health indicator (which sources succeeded this cycle).
- Provenance badge on every panel.
- Mobile-readable (executives check phones), but optimised for the big screen.

---

## 7. Reporting — Weekly SITREP

A server route assembles current `national_status.json` + sector risk + top movers into a templated **Weekly ENSO Situation Report** (HTML, print-to-PDF). Write each generated report into `/data/sitreps/`. Template structure follows the concept's SITREP intent: status, key indicators, provincial risk, sector highlights, recommended actions. Auto-fill from the data files; allow a free-text "analyst note" field.

---

## 8. Build order

Follow `BUILD_CHECKLIST.md`. High level:
1. Repo + Next.js + Vercel wired, domain live (empty shell deploys).
2. Data model (JSON shapes + `/data` folder) + province GeoJSON in `/public`.
3. Ingestion Action: HDX HAPI (food security) + one real climate indicator (ONI) end-to-end → commits JSON.
4. Risk engine + thresholds file + unit tests.
5. File reads + Page 1 (KPIs, risk matrix, heat map).
6. Remaining climate indicators + Page 2.
7. Sector panels + provenance badges + Page 3.
8. Page 4 + SITREP generator.
9. Seed `DEMO` data for gap sectors; polish for the big-screen demo.

**Definition of done for the PoC:** a visitor to `newcis.in4metrix.dev` sees a live national operating picture where ONI and PNG food-security data are genuinely real (badged `LIVE`), the four focus provinces are risk-coloured on an interactive map, the traffic-light logic is demonstrably driven by the thresholds file, and one Weekly SITREP can be generated on demand.

---

## 9. Secrets / config (GitHub Actions + Vercel)
- `HDX_APP_ID` — HDX HAPI app identifier (GitHub Actions secret)
- The ingestion Action commits to the repo using the built-in `GITHUB_TOKEN` (grant the workflow `contents: write` permission) — no extra secret needed.
- Vercel needs no data secrets: it reads static files committed to the repo.
- NOAA/NASA endpoints are mostly keyless; NASA Earthdata may need an account for some products — prefer keyless products for the PoC.
- **When the DB returns (Phase 2):** reintroduce `SUPABASE_URL` / service-role key (Action writes) and `NEXT_PUBLIC_SUPABASE_*` (frontend reads). Swap the file-read helpers for DB queries against the same shapes from §3.

## 10. Guardrails for Claude Code
- Keep the risk engine pure and tested; it is the intellectual core.
- Never present `DEMO` data as `LIVE`.
- Ingestion failures must degrade gracefully (show last-good + flag), never blank the dashboard.
- Province-agnostic engine, focus-province seeding — so scaling to 22 provinces is data, not code.
- Prefer keyless/free endpoints; defer anything needing paid licences or heavy raster processing to production notes.

---

## 11. Design system

Full reference: [`docs/design-system.md`](./docs/design-system.md). Quick rules for new UI:

- **Tokens, not hex.** Use semantic CSS vars (`--surface-1`, `--text-muted`, `--accent`, `--status-red`, …) or their Tailwind aliases (`bg-surface-1`, `text-text-muted`, `border-border-default`). Never hardcode zinc-* in new code.
- **Primitives, not divs.** Compose with `Card`, `MetricTile`, `StatusPill`, `Badge`, `Button`, `SectionHeader`, `EmptyState` from `src/components/ui/`.
- **Numbers get `data-numeric`** — routes them to JetBrains Mono with tabular nums.
- **Status colour is intent.** Red/amber/green are reserved for traffic-light readouts; use `text-muted` for neutral meta.
- **Icons:** lucide-react, `size={12}` inline, `size={14}` in section headers.
- **Motion:** framer-motion only for meaningful state change (gauge fill on data update). Respect `prefers-reduced-motion` (handled in `globals.css`).
- **Theming:** `.dark` (default) and `.light` on `<html>` swap the semantic token layer. `ThemeToggle` persists choice in `localStorage`; a no-flash inline script in `layout.tsx` applies it pre-paint.
