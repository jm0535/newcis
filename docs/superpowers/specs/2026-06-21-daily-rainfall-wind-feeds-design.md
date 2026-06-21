# Daily Rainfall + Wind Feeds — Design

**Date:** 2026-06-21
**Status:** Approved, ready for implementation plan

## Goal

Add two LIVE daily-cadence climate indicators to NEWCIS, sourced from the
keyless Open-Meteo ERA5 archive, without disturbing the existing CHIRPS
(dekadal rainfall) and NOAA (monthly trade-wind) feeds:

- `RAINFALL_DAILY` — 7-day rainfall anomaly, refreshed daily.
- `WIND_ANOM` — 7-day wind anomaly + storm-day count, refreshed daily.

## Why separate indicators (not replacements)

The existing `RAINFALL_ANOM` (HDX HAPI · CHIRPS, dekadal) and `TRADE_WIND_ANOM`
(NOAA CPC wpac850, monthly) measure different things at different cadences and
are independently credible:

- CHIRPS is satellite-calibrated, the publishable rainfall anomaly.
- NOAA trade-wind is an equatorial-Pacific ENSO precursor (not PNG-local wind).

Overwriting either with a noisy daily local value would lose meaning. The new
indicators are additive: PNG-local, 7-day, daily-refreshed, surfaced in a
clearly-labelled "Daily Watch" group so the cadence distinction is honest.

## Data sources

Both indicators come from Open-Meteo's historical archive
(`https://archive-api.open-meteo.com/v1/archive`), keyless, already wired in
`ingest/sources/open-meteo.ts`. New daily field required: `wind_speed_10m_max`
(added alongside the existing `precipitation_sum`, `temperature_2m_max`).

### Indicators

| Key | Label | Window | Unit | Threshold ladder |
|---|---|---|---|---|
| `RAINFALL_DAILY` | Rainfall (7-day, daily) | recent 7d vs 8-yr same-7d normal | % of 8-yr normal | inverted (dry = worse) |
| `WIND_ANOM` | Wind anomaly (7-day, daily) | recent 7d mean daily-max vs 8-yr normal | % of 8-yr normal | one-sided (high = worse) |

- **7-day recent window** (vs the existing 30-day) so the daily gauges are
  meaningfully different from the dekadal/monthly ones — they answer "what
  changed this week".
- **8-year same-window normal** computed exactly as the existing 30-day
  anomalies are, for consistency.

### Storm-day count

`WIND_ANOM` carries a `storm_days` integer: the number of days in the 7-day
window where ANY focus-province `wind_speed_10m_max >= WIND_STORM_DAY_MS`.

- `WIND_STORM_DAY_MS = 10.8` m/s (Beaufort 6, "strong breeze") — a single,
  explainable, config-driven absolute cutoff. Lives in `risk_thresholds.json`
  so it retunes without a code change (honouring CLAUDE.md §5).

## Components & data flow

### `ingest/sources/open-meteo.ts` (extend)

1. Add `wind_speed_10m_max` to the `daily=` query param.
2. Add a 7-day recent window fetch + its 8-yr normals (alongside the existing
   30-day fetch). Two windows per province now.
3. `fetchProvince` returns added per-province fields:
   `rain7_anom_pct`, `wind7_anom_pct`, plus the per-province per-day max-wind
   series needed to count storm days at the aggregate level.
4. Build two new indicators in `OpenMeteoResult`:
   `rainfall_daily_indicator`, `wind_anom_indicator`.
5. Compute `storm_days` across the focus provinces and surface it on the result
   (the `Indicator` type stays clean; `storm_days` rides in the wind indicator's
   label and a typed `meta` field on `OpenMeteoResult`, rendered in the UI
   caption).

**File-size guard:** open-meteo.ts is ~197 lines today. If the additions push it
past ~400, split the pure anomaly/storm math into
`ingest/sources/open-meteo-anomaly.ts` and keep the fetch orchestration in the
main file. Decide at implementation time.

### `ingest/lib.ts` (orchestrator)

After the existing Open-Meteo promote block:

1. Push `rainfall_daily_indicator` and `wind_anom_indicator` (always, when
   Open-Meteo succeeded — they are primary for their own keys, not a backstop).
2. Compute each trend via `computeTrend(key, value, history, 0.05, 0.05, observed_at)`
   (self-date skip), then append to history.
3. When `storm_days > 0`, emit per-province **Disaster & Hazard** sector rows
   reflecting the storm signal (escalating that cell, never the national alert).
4. Add `RAINFALL_DAILY` and `WIND_ANOM` to `NON_ALERT_KEYS`.

### `data/risk_thresholds.json`

Add three rows:

- `RAINFALL_DAILY` — inverted ladder mirroring `RAINFALL_ANOM`
  (`green_max: -20, amber_max: -40, red_max: -60`, `inverted: true`).
- `WIND_ANOM` — one-sided high-is-worse ladder, % above the 8-yr normal:
  `green_max: 25, amber_max: 50, red_max: 100`, `symmetric: false` (a sustained
  7-day mean wind 25–50% above normal = watch, 50–100% = alert, >100% = strong).
  These are starting bands, retunable in the file.
- `WIND_STORM_DAY_MS` config value `10.8` (a config row consumed by the source,
  not a classified indicator).

### `src/lib/ui.ts`

- Add `RAINFALL_DAILY`, `WIND_ANOM` to the gauge meta map.
- `SOURCE_CADENCE_DAYS`: `RAINFALL_DAILY: 8`, `WIND_ANOM: 8`.
- Add both to the sparkline range map.

### Page 2 (`/forecast` climate / ENSO Climate Intelligence page)

- New `SectionHeader` "Daily Watch · 7-day, refreshed daily" introducing a
  sub-group.
- Two `IndicatorGauge`s: `RAINFALL_DAILY`, `WIND_ANOM`.
- Wind gauge caption shows the storm-day count, e.g. "3 storm-days / 7".
- Both carry the `LIVE` badge + Open-Meteo source label; figures use
  `data-numeric`.

## National alert participation

Both `RAINFALL_DAILY` and `WIND_ANOM` are in `NON_ALERT_KEYS` — they do NOT
raise the national ENSO traffic-light. Rationale matches the shipped SEISMIC
fix: short-window local hazards inform per-province cells but must not pin the
national ENSO alert on noise. The national alert stays driven by the ENSO spine
(ONI, SOI, trade-wind, soil moisture). Storm-days still escalate the
per-province Disaster & Hazard cell.

## Error handling

- **Open-Meteo fails:** both daily indicators absent; existing last-good
  backfill carries the previous reading forward; `open_meteo: false` flag in
  `last_run.json`. Page 2 daily group degrades to "—". Dashboard never blanks.
- **Partial province failure:** average over reporting provinces; label
  "(N of 4 reporting)".
- **No fabricated freshness:** if a value can't be produced it is not stamped
  with a fake `observed_at` (consistent with the hdx-rainfall honesty fix).

## Testing

Pure functions, fixed fixtures:

1. **Storm-day counter** — fixture of 7 days with known per-province max winds +
   cutoff 10.8 → asserts the expected count.
2. **7-day anomaly %** — recent vs normal fixture → asserts the rounded %.
3. **NON_ALERT_KEYS exclusion** — `rollUpNational` with a windy week
   (`WIND_ANOM` high) + a very wet/dry `RAINFALL_DAILY` + neutral ONI → asserts
   national `alert_level` stays GREEN.

## Out of scope

- Per-province percentile wind cutoffs (rejected option B — execs can't read it).
- Two-tier gale/windy split (rejected option C for the cutoff — single threshold
  is explainable).
- Demoting CHIRPS or NOAA trade-wind.
- Daily indicators driving the national alert.
