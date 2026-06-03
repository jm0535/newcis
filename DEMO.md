# NEWCIS — 5-Minute Demo Walkthrough

A script for showing the prototype to a mixed room: NSA / executive decision-makers on one side, technical evaluators (CTO, data team) on the other. The same screens speak to both audiences if you frame it right.

> Live at **[newcis.in4metrix.dev](https://newcis.in4metrix.dev)**. Open it on a big screen if you can — the layout is designed for an ops-centre wall.

---

## The one-line frame

> "This is a working slice of a national climate intelligence system for PNG. Real climate data, real risk logic, a credible operating picture — built in days, not quarters, on open infrastructure. Production maps cleanly onto Power BI + ArcGIS later."

Memorise that. Everything else is evidence for it.

---

## Minute 1 — The status bar + KPIs (executive lens)

Land on the **Overview** page (`/`). Point at the top bar:

- **`GREEN · ENSO Neutral`** — current national alert level and ENSO phase. *"This is the single status line you'd brief the PM with."*
- **Source dots** (top-right of status bar) — *"Five sources fed this picture. All green this cycle — NOAA ONI, HDX rainfall, NASA soil moisture, HDX ACLED, HDX food security."*
- **KPI strip** — six tiles, glanceable. *"Phase, alert, risk rating, affected population, high-risk provinces, forecast window. This is page 1 of a SITREP made interactive."*

Audience cue: **execs want one number per topic**. The KPI strip *is* the deliverable.

---

## Minute 2 — The map + risk matrix (the headline)

Scroll to the **Provincial Heat Map** + **National Risk Matrix** side-by-side.

- Click **Enga** on the map. Popup shows province name, code (PG08), current risk.
- *"Each focus province is coloured by its worst sector risk. The full 22 provinces are drawn but greyed — explicit honesty about what the slice covers."*
- Switch basemap (top-right of map) — OSM, Topo, Satellite. *"Operational context matters: highlands terrain looks very different on a topo map than on imagery."*
- Look at the **Risk Matrix** to the left: 7 sectors × 4 focus provinces. Traffic-light cells. *"This is the engine's output. Every cell is explainable in one sentence — that matters when the room asks why a province is red."*

Audience cue: this is where execs and technicals diverge. Execs see the picture. Technicals start asking how the cells are computed.

---

## Minute 3 — The credibility layer (technical lens)

Switch to **ENSO Climate** (`/climate`).

- *"This is the data behind the dots. Every indicator carries a `LIVE` or `DEMO` badge — we never blur the two."*
- Point at **ONI** gauge: real value pulled from NOAA CPC this cycle. The vertical marker shows where we sit across the GREEN/AMBER/RED/BLACK bands.
- Point at **Rainfall Anomaly**: real per-province values from HDX rainfall (CHIRPS-derived).
- Scroll to **Threshold Bands**: *"This table is the engine's spine. Bands live in a JSON file — `data/risk_thresholds.json` — and any analyst can retune them without touching code."*
- Open the file in another window if the audience is technical:

  ```bash
  cat data/risk_thresholds.json | head -20
  ```

  *"ONI thresholds match NOAA CPC operational bands. Rainfall bands match the 1997 and 2015 PNG drought response thresholds."*

Audience cue: this is the moment that buys you credibility with the technical room. *Real data + explainable logic + tunable thresholds, with no AI hand-waving.*

---

## Minute 4 — Sectoral panels + the El Niño story

Switch to **Sectoral Impact** (`/sectors`).

- Seven sectors, each panel showing per-focus-province cells + the driving indicators.
- *"Water Security in Southern Highlands is driven by rainfall anomaly + soil moisture. Both are LIVE. The cell colour is the worst of the two."*
- *"Some sectors — Energy, Infrastructure — currently show DEMO. That's because PNG agencies (PNG Power, DoW) don't expose public APIs yet. The badge tells the truth; the production phase wires those in."*

**The El Niño story** (rehearse this — it's the one you'll be asked):

> "If ONI crossed 1.5 tomorrow — a strong El Niño event like 1997 or 2015 — this dashboard would flip to BLACK without anyone touching code. The threshold file already encodes that band, and the engine re-runs every refresh."

---

## Minute 5 — Operations + the SITREP finale

Switch to **Operations** (`/operations`).

- **Refresh button** (top right): *"Anyone in the ops centre can trigger an ingest live."* Click it. Watch the timestamp update.
- Scroll to **Generate Weekly SITREP**.
- Type a one-line analyst note ("El Niño watch — DAL advisory issued").
- Click **Generate**. A new tab opens with a fully-templated SITREP — header, national status, indicator readings, sector highlights, recommended actions, analyst note inline.
- *"Print to PDF — that's a finished weekly product, generated in two seconds from current state."*

**Close with this:**

> "Every layer you've just seen has a named production successor. Ingestion → Power Automate. JSON store → SQL Server. Engine → Power BI DAX. Map → ArcGIS for Power BI. This isn't a throwaway demo; it's the working architecture, in compact form."

---

## Likely questions (and short answers)

**"Is this AI-driven forecasting?"**
No. This is **deterministic risk classification** against published thresholds. AI forecasting is a Phase-3 production extension, not what we're proving here. The credibility argument is "explainable today; smarter later."

**"Why not Power BI now?"**
PoC speed and openness. Power BI would have required licences, dataset modelling, and a Power BI Service tenancy before anyone saw a screen. This stack got a working operating picture into a browser in days. The data shapes are deliberately portable.

**"What's LIVE vs DEMO right now?"**
LIVE: ONI (NOAA), rainfall (HDX/CHIRPS), soil moisture (NASA POWER/SMAP-derived), ACLED conflict events (HDX), food security (HDX HAPI). DEMO: PNG agency feeds (DAL, Health, Water PNG, Treasury, PNG Power) — these have no public APIs and are explicitly badged DEMO until production wiring.

**"How often does it refresh?"**
PoC: on-demand via the Refresh button + a local 6-hourly cron. Production target: GitHub Actions or Power Automate every 6 hours, decoupled from the dashboard. The dashboard always reads static files — so it never blocks on an upstream API mid-brief.

**"Who can edit the thresholds?"**
Any analyst with repo write access. Edit `data/risk_thresholds.json`, push — the next ingest re-classifies everything. In production this lives in a SQL Server table with the same audit trail.

**"What about 22 provinces?"**
The engine is province-agnostic. The boundary file already carries all 22; we've seeded only 4 for the slice. Scaling is a data-loading task, not an engineering one.

---

## If the demo breaks live

- Status bar will show a red source dot if a cycle failed. The dashboard keeps the last-good values; nothing blanks.
- If the Refresh button fails: open `/api/sitrep` to fall back to the most recent stored SITREP.
- If the network is down entirely: every screen still works against the JSON files already committed in the repo — there is no live data dependency at view time.

That last bullet is also the architectural point: **the dashboard is decoupled from the data pipeline by design.** It's a feature, not a fallback.
