# NEWCIS PoC — Build Checklist

Task-by-task execution plan for Claude Code. Each task has a **goal**, a **prompt** you can paste, and a **done-when** check. Work top to bottom; each phase deploys something demonstrable. Read `CLAUDE.md` first.

Legend: ⬜ not started · 🟦 in progress · ✅ done

---

## PHASE 0 — Foundations (deploy an empty shell first)

### ⬜ 0.1 Repo + Next.js
**Prompt:** "Create a Next.js (App Router, TypeScript) project named `newcis-poc`. Initialise a git repo, add a sensible `.gitignore`, and a minimal landing page that renders 'NEWCIS — National ENSO Early Warning & Climate Intelligence System' with a 'PROTOTYPE' badge. Use Tailwind."
**Done when:** runs locally at `/`.

### ⬜ 0.2 Data folder + read helpers + types
**Prompt:** "Create the `/data` folder with empty/placeholder JSON files per CLAUDE.md §3 (`indicators.json`, `readings_history.json`, `risk_thresholds.json`, `sector_risk.json`, `national_status.json`, `last_run.json`, and a `/data/sitreps/` dir). Define a `lib/types.ts` with the TypeScript interfaces for each shape. Add `lib/data.ts` with typed read helpers that load these files (server-side). Commit a `.gitkeep` in `sitreps/`."
**Done when:** types compile; read helpers return typed placeholder data.

### ⬜ 0.3 Vercel + domain + CI
**Prompt:** "Prepare the project for Vercel deployment. Document the steps to connect the GitHub repo to Vercel and bind the domain `newcis.in4metrix.dev`. No data env vars are needed (the app reads static repo files). Only document where `HDX_APP_ID` will live later (GitHub Actions secret, not Vercel)."
**Done when:** pushing to `main` auto-deploys; `newcis.in4metrix.dev` serves the shell.

---

## PHASE 1 — Data shapes & geometry

### ⬜ 1.1 Finalise data shapes + thresholds file
**Prompt:** "Confirm `lib/types.ts` matches CLAUDE.md §3. Populate `/data/risk_thresholds.json` with documented ENSO/indicator bands (ONI El Niño/La Niña watch & alert thresholds, rainfall-anomaly bands, SST-anomaly bands). Put the rationale for each band in an adjacent `risk_thresholds.md` note. These drive the traffic-light system and must be retunable by editing the file, no code change."
**Done when:** thresholds file loads via the read helper; bands justified in the note.

### ⬜ 1.2 Load PNG province boundaries → static GeoJSON
**Prompt:** "Write a one-off Node script `scripts/build-provinces-geojson.ts` that downloads PNG admin-level-1 boundaries from the OCHA/HDX Common Operational Dataset (fallback: GADM level 1), simplifies the polygons for web use (mapshaper-style), bakes `code` (p-code), `name`, `population`, and `is_focus` into each feature's properties (Enga, Western Highlands, Southern Highlands, Gulf = true), and writes `/public/provinces.geojson`. Print a summary."
**Done when:** `/public/provinces.geojson` exists; all provinces present; 4 flagged focus; valid geometry.

---

## PHASE 2 — Ingestion (real data, the credibility core)

### ⬜ 2.1 HDX HAPI app identifier + admin1 p-codes
**Prompt:** "Write `scripts/hdx-bootstrap.ts` that (a) documents how to generate an HDX HAPI `app_identifier`, and (b) fetches PNG admin1 names + p-codes from the HAPI admin1 metadata endpoint and reconciles them with the `code` properties in `/public/provinces.geojson`. Store `HDX_APP_ID` as a GitHub Actions secret."
**Done when:** PNG province p-codes confirmed and matched to the GeoJSON features.

### ⬜ 2.2 First real climate indicator — ONI (NOAA)
**Prompt:** "Create an ingestion module `ingest/sources/oni.ts` that fetches the latest Oceanic Niño Index from NOAA CPC, parses the most recent value + prior value (for trend), and returns a normalised reading `{ key:'ONI', value, observed_at, trend }`. Handle parse failures gracefully."
**Done when:** running it prints a real current ONI value.

### ⬜ 2.3 First real sectoral source — HDX food security
**Prompt:** "Create `ingest/sources/hdx-food-security.ts` that queries HDX HAPI `food-security-nutrition-poverty/food-security` for `location_code=PNG` across our focus-province p-codes, returning normalised IPC phase / food-insecurity readings per province with `provenance:'LIVE'`."
**Done when:** real food-security records returned for the focus provinces (or a clear, logged 'no current data' per province).

### ⬜ 2.4 Ingestion orchestrator + audit + JSON writes
**Prompt:** "Create `ingest/run.ts` that calls all source modules, writes results to the `/data/*.json` files (update `indicators.json`, append to `readings_history.json`), writes `last_run.json` (which sources succeeded/failed, timing), and never throws on a single-source failure. Runnable via `npm run ingest`."
**Done when:** one command updates the data files and writes a `last_run.json` audit record.

### ⬜ 2.5 GitHub Actions schedule + commit-back
**Prompt:** "Add `.github/workflows/ingest.yml` running `npm run ingest` on a cron (every 6 hours) and on manual dispatch, using the `HDX_APP_ID` secret. Grant the workflow `contents: write` and have it commit the changed `/data` files back to `main` (using the built-in `GITHUB_TOKEN`); the commit triggers a Vercel redeploy. It must NOT run on Vercel. Document why ingestion is decoupled from the frontend (CLAUDE.md §1)."
**Done when:** the Action runs green on schedule and manual trigger; a data commit appears and Vercel redeploys.

---

## PHASE 3 — Risk engine (analytical core)

### ⬜ 3.1 Pure engine
**Prompt:** "Implement `lib/risk/engine.ts`: a pure module that takes indicator readings + sectoral data + thresholds and returns (a) per-indicator alert levels, (b) per-province per-sector risk levels, (c) a national rollup. No file I/O inside. Follow CLAUDE.md §5. Keep formulas simple and commented so a non-technical reviewer can follow 'why is this province red'."
**Done when:** function compiles with clear typed inputs/outputs.

### ✅ 3.2 Tests (this convinces the technical room)
**Prompt:** "Write unit tests for the risk engine with fixtures: a neutral scenario → GREEN; a strong-El-Niño ONI + dry rainfall anomaly → RED with the focus provinces escalated. Assert national rollup matches."
**Done when:** tests pass; an El Niño fixture deterministically yields RED.

### ⬜ 3.3 Wire engine into ingestion
**Prompt:** "After ingestion gathers readings, run the risk engine and write its output into `/data/sector_risk.json` and `/data/national_status.json`. Add to `ingest/run.ts` so a single `npm run ingest` produces fully computed data files."
**Done when:** `national_status.json` and `sector_risk.json` reflect the latest real data automatically.

---

## PHASE 4 — Data reads & Page 1

### ⬜ 4.1 Read layer
**Prompt:** "Using the `lib/data.ts` helpers, expose the data to pages via server components (or thin Route Handlers if a client component needs it): national status, latest indicators + trend, sector risk, and the static provinces GeoJSON. Type every return. Reads come straight from the committed `/data` files and `/public/provinces.geojson` — no database, no external calls at request time."
**Done when:** pages can render typed data sourced entirely from repo files.

### ⬜ 4.2 Page 1 — Executive Strategic Overview
**Prompt:** "Build the home dashboard page per CLAUDE.md §6 Page 1: header KPI cards, 7-sector national risk matrix (traffic-light + trend arrows), and a MapLibre provincial heat map of the focus provinces coloured by overall risk (join `sector_risk.json` to `provinces.geojson` on `code`), click → province detail drawer. Add the persistent status bar (ENSO status, alert light, 'last updated' from `last_run.json`, data-health). Optimise for a large operations-centre screen."
**Done when:** Page 1 renders live data with a working interactive map.

---

## PHASE 5 — Climate intelligence & remaining indicators

### ⬜ 5.1 Remaining real/seeded indicators
**Prompt:** "Add source modules for SOI (BoM), SST (NOAA Coral Reef Watch), and NDVI + soil moisture (NASA, national aggregate acceptable). For rainfall/temperature anomalies without a clean PNGNWS feed, seed realistic values marked `DEMO`. Register each in `indicators.json` with correct provenance."
**Done when:** all seven indicators present, each badged honestly.

### ⬜ 5.2 Page 2 — ENSO Climate Intelligence
**Prompt:** "Build Page 2 per CLAUDE.md §6: indicator gauges, 12-month trend lines (from `readings_history.json`), the historical-comparison strip (1997–98, 2015–16, 2023–24, current), and the early-warning threshold panel. Pull from `indicators.json`."
**Done when:** Page 2 shows live gauges + trends with provenance badges.

---

## PHASE 6 — Sectoral impact

### ⬜ 6.1 Real sectoral sources
**Prompt:** "Add HDX HAPI sources for food prices (WFP VAM), conflict events (ACLED → social stability), and rainfall hazard. Map them to the relevant sectors and provinces, provenance `LIVE`."
**Done when:** food, social-stability, hazard panels carry real data.

### ⬜ 6.2 Seed gap sectors
**Prompt:** "Add realistic `DEMO` entries to `sector_risk.json` for Water, Public Health, Energy, Infrastructure for the focus provinces, each with `provenance:'DEMO'` and a `data_source` note ('awaiting agency feed'). Have the ingestion run preserve these DEMO rows when it rewrites the file (only LIVE sectors are overwritten by real sources)."
**Done when:** every sector panel has content; gaps clearly marked DEMO.

### ⬜ 6.3 Page 3 — Sectoral Impact
**Prompt:** "Build Page 3 per CLAUDE.md §6: one panel per sector with lead-agency labels and a prominent LIVE/DEMO provenance badge. Show level, trend, and underlying indicators."
**Done when:** Page 3 complete; provenance unmistakable on each panel.

---

## PHASE 7 — Operations centre & SITREP

### ⬜ 7.1 Page 4 — Intelligence & Operations
**Prompt:** "Build Page 4 per CLAUDE.md §6: national situation summary, high-risk province list, cluster status board (seeded), action tracker (seeded), and a 'Generate Weekly SITREP' button."
**Done when:** Page 4 renders; SITREP button present.

### ⬜ 7.2 SITREP generator
**Prompt:** "Implement `/api/sitrep/generate`: assemble current `national_status.json` + sector risk + top movers into a templated Weekly ENSO SITREP (HTML, print-to-PDF friendly), write it to `/data/sitreps/`, and return it. Include an editable analyst-note field. Structure: status / key indicators / provincial risk / sector highlights / recommended actions."
**Done when:** clicking the button produces a real, populated SITREP from live data and saves it.

---

## PHASE 8 — Demo polish

### ⬜ 8.1 Big-screen layout pass
**Prompt:** "Do a visual pass for a large operations-centre display per CLAUDE.md §6 / the concept's screen layout: top status banner, central map (~60%), right-hand provincial risk + alerts panel, bottom assessment/actions strip. High contrast, glanceable."
**Done when:** Page 1 reads cleanly from across a room.

### ⬜ 8.2 Resilience + 'last good' behaviour
**Prompt:** "Verify graceful degradation: simulate an HDX/NOAA failure and confirm the dashboard shows last-good values (the previously committed `/data` files) with a data-health warning rather than blanking. Confirm `last_run.json` reflects the failure. Also confirm SITREP generation works as a client-side render/download (Vercel runtime is read-only, so it cannot self-commit — persisting a SITREP to `/data/sitreps/` is done by the Action or a manual commit; document this)."
**Done when:** a forced source failure degrades gracefully; SITREP behaviour documented.

### ✅ 8.3 Demo script + README
**Prompt:** "Write `README.md` (architecture, how to run, how ingestion is decoupled) and `DEMO.md`: a 5-minute walkthrough for a mixed technical+executive audience — what's LIVE vs DEMO, the El Niño risk-logic story, and the SITREP finale."
**Done when:** a newcomer can run and demo the PoC from the docs.

---

## PHASE 9 — Design system & enterprise polish

### ✅ 9.1 Design tokens + UI primitives
Semantic CSS variable layer (`--surface-*`, `--text-*`, `--accent`, `--status-*`, spacing, radii, elevation, type scale, motion) in `src/app/globals.css`. Class-based theming (`.dark` / `.light` on `<html>`) with no-flash inline script. Primitives in `src/components/ui/` — `Card`, `MetricTile`, `StatusPill`, `SectionHeader`, `Badge`, `Button`, `EmptyState`.

### ✅ 9.2 Component refactor + a11y + motion
All dashboard components rewritten on primitives + tokens. Inter + JetBrains Mono via `next/font` (`data-numeric` attribute for tabular nums). lucide-react icons. focus-visible outlines, ARIA labels, `role="radiogroup"` on basemap switcher, `aria-current` on nav. Subtle motion via framer-motion (gauge marker animates in). `prefers-reduced-motion` respected.

### ✅ 9.3 Docs
Design tokens + primitives reference: see `docs/design-system.md`.

---

## Mapping back to production (keep visible for the executive story)
| PoC artefact | Becomes in production |
|---|---|
| GitHub Action ingestion | Power Automate / Azure Data Factory |
| Versioned JSON files in repo | SQL Server (via Supabase/Postgres as an interim Phase-2 step) |
| Risk engine (TS) | Power BI DAX measures + thresholds |
| MapLibre + static GeoJSON | ArcGIS Maps for Power BI / ArcGIS Enterprise |
| Next.js dashboard | Power BI Service (4-page executive report) |
| SITREP route | Power Automate scheduled report |
| `DEMO` sector panels | Live DAL / Health / Water PNG / Treasury feeds |

This table is also your Phase-1→Phase-4 roadmap slide: the PoC is not throwaway — every layer has a named production successor.

### Phase-2 note: reintroducing a database
The file-based store is a deliberate PoC simplification. Bring back a DB when you need query-time history, concurrent writers, or >~22 provinces with time series. Because §3 defines the data as typed shapes, the swap is: (1) create tables matching those shapes, (2) point `lib/data.ts` read helpers at the DB instead of the files, (3) have the ingestion Action write to the DB instead of committing JSON. The app, risk engine, and UI are untouched.
