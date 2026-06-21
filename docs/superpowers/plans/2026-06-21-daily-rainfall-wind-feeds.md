# Daily Rainfall + Wind Feeds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two additive LIVE daily-cadence climate indicators — `RAINFALL_DAILY` (7-day rainfall anomaly) and `WIND_ANOM` (7-day wind anomaly + storm-day count) — sourced from the keyless Open-Meteo ERA5 archive, surfaced in a "Daily Watch" sub-group on the Climate page, without touching the existing CHIRPS dekadal rainfall or NOAA monthly trade-wind feeds.

**Architecture:** Pure anomaly + storm-day math lives in `ingest/sources/open-meteo.ts` as exported, unit-tested functions. The existing per-province fetch gains a second (7-day) window and the `wind_speed_10m_max` daily field. The orchestrator (`ingest/lib.ts`) always promotes the two new indicators when Open-Meteo succeeds, computes their trend with the existing self-date-skip, and adds both keys to `NON_ALERT_KEYS` so they never raise the national ENSO alert. Thresholds are config-driven in `data/risk_thresholds.json`. The Climate page partitions indicators into a "Daily Watch" group and the rest.

**Tech Stack:** TypeScript, Next.js App Router (React 19), vitest 4, tsx (CLI smoke tests), Open-Meteo ERA5 archive (keyless HTTP).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `ingest/sources/open-meteo.ts` | Fetch per-province daily blocks; compute 30-day + 7-day anomalies; count storm days; emit 4 indicators | Modify |
| `tests/open-meteo.test.ts` | Unit-test the pure anomaly-% and storm-day-count helpers | Create |
| `ingest/lib.ts` | Promote the two new indicators, compute trend, append history, emit storm Disaster rows | Modify |
| `src/lib/risk-engine.ts` | Add `RAINFALL_DAILY`, `WIND_ANOM` to `NON_ALERT_KEYS` | Modify |
| `tests/risk-engine.test.ts` | Assert the two daily keys are excluded from the national alert | Modify |
| `data/risk_thresholds.json` | Threshold bands for the two indicators + the storm-day cutoff config row | Modify |
| `src/lib/ui.ts` | `INDICATOR_META` + `SOURCE_CADENCE_DAYS` entries for both keys; export the Daily-Watch key set | Modify |
| `src/app/climate/page.tsx` | Partition indicators into a "Daily Watch" sub-group + the rest | Modify |

---

## Task 1: Pure anomaly + storm-day helpers (exported, tested)

Extract the anomaly-% formula into a named exported function and add a storm-day counter, both pure and testable. This is the analytical core of the new indicators.

**Files:**
- Modify: `ingest/sources/open-meteo.ts`
- Test: `tests/open-meteo.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/open-meteo.test.ts`:

```typescript
/**
 * Open-Meteo daily-feed helpers. Pure anomaly-% and storm-day-count math,
 * tested against fixed fixtures. No network.
 */
import { describe, expect, it } from "vitest";
import { anomalyPct, countStormDays, STORM_DAY_MS } from "../ingest/sources/open-meteo";

describe("anomalyPct", () => {
  it("recent above normal → positive %", () => {
    // recent 120, normal 100 → +20%
    expect(anomalyPct(120, 100)).toBe(20);
  });
  it("recent below normal → negative %", () => {
    // recent 60, normal 100 → -40%
    expect(anomalyPct(60, 100)).toBe(-40);
  });
  it("rounds to one decimal", () => {
    // 33 vs 30 = +10% exactly; 31 vs 30 = +3.333.. → 3.3
    expect(anomalyPct(31, 30)).toBe(3.3);
  });
  it("zero normal → 0 (no divide-by-zero)", () => {
    expect(anomalyPct(50, 0)).toBe(0);
  });
});

describe("countStormDays", () => {
  it("counts days where ANY province max-wind hits the cutoff", () => {
    // 3 days × 2 provinces. Day 0: p1 11 (storm). Day 1: both calm.
    // Day 2: p2 17.2 (storm). → 2 storm days.
    const perDayMaxByProvince = [
      [11.0, 4.0], // day 0 → storm (11 >= 10.8)
      [3.0, 5.0], // day 1 → calm
      [6.0, 17.2], // day 2 → storm
    ];
    expect(countStormDays(perDayMaxByProvince, STORM_DAY_MS)).toBe(2);
  });
  it("no day reaches the cutoff → 0", () => {
    expect(countStormDays([[5, 6], [7, 8]], STORM_DAY_MS)).toBe(0);
  });
  it("ignores null wind values", () => {
    expect(countStormDays([[null, 12.0], [null, null]], STORM_DAY_MS)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/open-meteo.test.ts`
Expected: FAIL — `anomalyPct`, `countStormDays`, `STORM_DAY_MS` are not exported.

- [ ] **Step 3: Add the exported helpers**

In `ingest/sources/open-meteo.ts`, add near the existing `sum`/`mean` helpers (after the `mean` function, ~line 89):

```typescript
// Storm-day cutoff: a day counts as a "storm day" when any focus-province
// daily-max 10 m wind reaches this speed. 10.8 m/s = Beaufort 6 ("strong
// breeze"). A single explainable absolute threshold; the authoritative value
// lives in risk_thresholds.json (WIND_STORM_DAY_MS) and is passed in by the
// orchestrator — this constant is the fallback default for tests and direct use.
export const STORM_DAY_MS = 10.8;

// Anomaly as a percentage of the long-term normal, rounded to one decimal.
// Guards divide-by-zero (a zero normal — e.g. a desert window — yields 0).
export function anomalyPct(recent: number, normal: number): number {
  if (normal <= 0) return 0;
  return Math.round(((recent - normal) / normal) * 1000) / 10;
}

// Count days in the recent window where AT LEAST ONE focus province's daily-max
// wind reached the cutoff. Input is [day][province] of daily-max wind (m/s);
// nulls (missing) are treated as below-cutoff.
export function countStormDays(
  perDayMaxByProvince: (number | null)[][],
  cutoff: number,
): number {
  return perDayMaxByProvince.filter((day) =>
    day.some((w) => w !== null && w >= cutoff),
  ).length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/open-meteo.test.ts`
Expected: PASS — all 7 assertions green.

- [ ] **Step 5: Commit**

```bash
git add ingest/sources/open-meteo.ts tests/open-meteo.test.ts
git commit -m "feat: pure anomaly-% + storm-day helpers for Open-Meteo daily feeds"
```

---

## Task 2: Fetch the 7-day window + wind, build the two indicators

Add `wind_speed_10m_max` to the daily query, fetch a recent 7-day window alongside the existing 30-day one, compute the daily rainfall + wind anomalies, count storm days, and emit two new indicators on the result.

**Files:**
- Modify: `ingest/sources/open-meteo.ts`

- [ ] **Step 1: Add `wind_speed_10m_max` to the daily block type + query**

In `ingest/sources/open-meteo.ts`, extend the `DailyBlock` interface (currently ~line 33):

```typescript
interface DailyBlock {
  precipitation_sum: (number | null)[];
  temperature_2m_max: (number | null)[];
  wind_speed_10m_max: (number | null)[];
}
```

And add it to the `daily=` param in `fetchWindow` (currently ~line 77):

```typescript
    daily: "precipitation_sum,temperature_2m_max,wind_speed_10m_max",
```

- [ ] **Step 2: Extend `ProvinceAnomaly` with the daily fields**

Replace the `ProvinceAnomaly` interface (currently ~line 91):

```typescript
interface ProvinceAnomaly {
  code: string;
  rainfall_anom_pct: number; // 30-day, feeds the RAINFALL_ANOM backstop
  temp_anom_c: number; // 30-day, feeds TEMP_ANOM
  rain7_anom_pct: number; // 7-day, feeds RAINFALL_DAILY
  wind7_anom_pct: number; // 7-day mean daily-max wind, feeds WIND_ANOM
  windDailyMax: (number | null)[]; // recent 7 daily-max winds, for storm-day counting
}
```

- [ ] **Step 3: Compute the 7-day window in `fetchProvince`**

Replace the body of `fetchProvince` (currently ~lines 97-125) with the version that fetches both windows. The existing 30-day logic is preserved; the 7-day block is added:

```typescript
async function fetchProvince(p: (typeof POINTS)[number]): Promise<ProvinceAnomaly> {
  const now = new Date();
  // Recent windows end 5 days back (the archive has a short lag).
  const recEnd = new Date(now.getTime() - 5 * 24 * 3600 * 1000);
  const recStart30 = new Date(recEnd.getTime() - 30 * 24 * 3600 * 1000);
  const recStart7 = new Date(recEnd.getTime() - 7 * 24 * 3600 * 1000);

  // 30-day window (existing RAINFALL_ANOM backstop + TEMP_ANOM).
  const recent30 = await fetchWindow(p.lon, p.lat, recStart30, recEnd);
  const recentPrecip30 = sum(recent30.precipitation_sum);
  const recentTmax = mean(recent30.temperature_2m_max.filter((v): v is number => v !== null));

  // 7-day window (new daily rainfall + wind).
  const recent7 = await fetchWindow(p.lon, p.lat, recStart7, recEnd);
  const recentPrecip7 = sum(recent7.precipitation_sum);
  const recentWind7 = mean(recent7.wind_speed_10m_max.filter((v): v is number => v !== null));

  const normPrecip30: number[] = [];
  const normPrecip7: number[] = [];
  const normWind7: number[] = [];
  const normTmax: number[] = [];
  for (let y = 1; y <= NORMAL_YEARS; y++) {
    const block30 = await fetchWindow(p.lon, p.lat, shiftYears(recStart30, y), shiftYears(recEnd, y));
    normPrecip30.push(sum(block30.precipitation_sum));
    const t = block30.temperature_2m_max.filter((v): v is number => v !== null);
    if (t.length) normTmax.push(mean(t));

    const block7 = await fetchWindow(p.lon, p.lat, shiftYears(recStart7, y), shiftYears(recEnd, y));
    normPrecip7.push(sum(block7.precipitation_sum));
    const w = block7.wind_speed_10m_max.filter((v): v is number => v !== null);
    if (w.length) normWind7.push(mean(w));
    await sleep(250);
  }

  return {
    code: p.code,
    rainfall_anom_pct: anomalyPct(recentPrecip30, mean(normPrecip30)),
    temp_anom_c: Math.round((recentTmax - mean(normTmax)) * 10) / 10,
    rain7_anom_pct: anomalyPct(recentPrecip7, mean(normPrecip7)),
    wind7_anom_pct: anomalyPct(recentWind7, mean(normWind7)),
    windDailyMax: recent7.wind_speed_10m_max.slice(0, 7),
  };
}
```

> Note: `rainfall_anom_pct` now uses `anomalyPct` instead of the old inline `normalPrecip > 0 ? Math.round((...)*1000)/10 : 0`. This is the same formula (DRY), so the existing RAINFALL_ANOM backstop value is unchanged.

- [ ] **Step 4: Add the two indicators + storm-day count to the result**

Extend `OpenMeteoResult` (currently ~line 127):

```typescript
export interface OpenMeteoResult {
  rainfall_indicator: Indicator;
  temp_indicator: Indicator;
  rainfall_daily_indicator: Indicator;
  wind_anom_indicator: Indicator;
  /** Days in the recent 7-day window with a storm-force gust in any province. */
  storm_days: number;
  /** Water/Food/Public-Health sector rows derived from per-province rainfall. */
  sector_rows: SectorRisk[];
  note: string;
}
```

In `fetchOpenMeteo`, after the existing `temp_indicator` block (~line 168) and before the `classifyRain` definition, add:

```typescript
  const meanRain7 = Math.round((results.reduce((s, r) => s + r.rain7_anom_pct, 0) / results.length) * 10) / 10;
  const meanWind7 = Math.round((results.reduce((s, r) => s + r.wind7_anom_pct, 0) / results.length) * 10) / 10;
  const stormDays = countStormDays(results.map((r) => r.windDailyMax), STORM_DAY_MS);

  const rainfall_daily_indicator: Indicator = {
    key: "RAINFALL_DAILY",
    label: `Rainfall (7-day, daily · ${results.length} of ${POINTS.length} provinces)`,
    unit: "% of 8-yr normal",
    source: "Open-Meteo archive (ERA5-derived)",
    update_frequency: "daily",
    provenance: "LIVE",
    value: meanRain7,
    observed_at: observedAt,
    trend: "flat",
  };

  const wind_anom_indicator: Indicator = {
    key: "WIND_ANOM",
    label: `Wind anomaly (7-day, daily · ${stormDays} storm-day${stormDays === 1 ? "" : "s"} / 7)`,
    unit: "% of 8-yr normal",
    source: "Open-Meteo archive (ERA5-derived)",
    update_frequency: "daily",
    provenance: "LIVE",
    value: meanWind7,
    observed_at: observedAt,
    trend: "flat",
  };
```

Then update the `return` of `fetchOpenMeteo` (currently ~line 190) to include the new fields:

```typescript
  return {
    rainfall_indicator,
    temp_indicator,
    rainfall_daily_indicator,
    wind_anom_indicator,
    storm_days: stormDays,
    sector_rows,
    note: `Open-Meteo: rainfall ${meanRain}% of normal, temp +${meanTemp}°C, 7d rain ${meanRain7}% / wind ${meanWind7}% / ${stormDays} storm-days (mean of ${results.length} provinces)`,
  };
```

- [ ] **Step 5: Typecheck + CLI smoke test (network) the source**

Run: `npx tsc --noEmit`
Expected: clean (no output).

Run (live network — confirms the real feed parses; if Open-Meteo is unreachable, skip and note it):

```bash
npx tsx -e "import('./ingest/sources/open-meteo.ts').then(async m => { const r = await m.fetchOpenMeteo(['PG07','PG12','PG09','PG02']); console.log('RAINFALL_DAILY', r.rainfall_daily_indicator.value, '| WIND_ANOM', r.wind_anom_indicator.value, '| storm_days', r.storm_days); })"
```

Expected: a line like `RAINFALL_DAILY <number> | WIND_ANOM <number> | storm_days <0..7>`. Values are real; exact numbers vary.

> If the focus p-codes above differ from `FOCUS_CODES`, read `src/lib/focus-provinces.ts` and use the real codes. The smoke test only confirms the feed parses end-to-end.

- [ ] **Step 6: Commit**

```bash
git add ingest/sources/open-meteo.ts
git commit -m "feat: Open-Meteo 7-day rainfall + wind indicators with storm-day count"
```

---

## Task 3: Thresholds for the two indicators + storm-day config

Add the band ladders so the gauges colour correctly, and the storm-day cutoff as a config row.

**Files:**
- Modify: `data/risk_thresholds.json`

- [ ] **Step 1: Add the three rows**

Append these objects to the array in `data/risk_thresholds.json` (before the closing `]`; add a comma after the current last object):

```json
  {
    "metric": "RAINFALL_DAILY",
    "unit": "% of 8-yr normal (focus provinces, 7-day)",
    "green_max": -20,
    "amber_max": -40,
    "red_max": -60,
    "inverted": true,
    "notes": "Open-Meteo ERA5 7-day rainfall anomaly, refreshed daily. Same inverted drought ladder as RAINFALL_ANOM: -20% near-normal; -40% drought watch; -60% severe. A fast daily complement to the CHIRPS dekadal RAINFALL_ANOM — a non-ENSO short-window signal, excluded from the national alert (see risk-engine NON_ALERT_KEYS)."
  },
  {
    "metric": "WIND_ANOM",
    "unit": "% above 8-yr normal (focus provinces, 7-day mean daily-max)",
    "green_max": 25,
    "amber_max": 50,
    "red_max": 100,
    "inverted": false,
    "symmetric": false,
    "notes": "Open-Meteo ERA5 7-day mean daily-max 10 m wind, as % above the 8-yr normal. One-sided (high = worse): 25–50% above normal = watch; 50–100% = alert; >100% = strong wind regime. Short-window local hazard, excluded from the national ENSO alert (see risk-engine NON_ALERT_KEYS); escalates the per-province Disaster & Hazard cell via storm-days."
  },
  {
    "metric": "WIND_STORM_DAY_MS",
    "unit": "m/s (daily-max 10 m wind)",
    "green_max": 10.8,
    "amber_max": 10.8,
    "red_max": 10.8,
    "inverted": false,
    "notes": "CONFIG ROW, not a classified indicator. The storm-day cutoff: a day counts as a storm day when any focus-province daily-max wind reaches this speed. 10.8 m/s = Beaufort 6. Consumed by ingest/lib.ts and passed to countStormDays; edit here to retune without a code change."
  }
```

- [ ] **Step 2: Validate the JSON**

Run: `node -e "const t=require('./data/risk_thresholds.json'); console.log(t.length, 'rows; new:', ['RAINFALL_DAILY','WIND_ANOM','WIND_STORM_DAY_MS'].map(m=>t.some(x=>x.metric===m)))"`
Expected: prints the row count and `new: [ true, true, true ]`.

- [ ] **Step 3: Commit**

```bash
git add data/risk_thresholds.json
git commit -m "feat: thresholds for daily rainfall + wind, storm-day cutoff config"
```

---

## Task 4: Exclude both keys from the national alert (engine + test)

`RAINFALL_DAILY` and `WIND_ANOM` are short-window local hazards. Like SEISMIC, they must not pin the national ENSO traffic-light.

**Files:**
- Modify: `src/lib/risk-engine.ts:305-311`
- Test: `tests/risk-engine.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/risk-engine.test.ts`, find the `describe` block containing the existing SEISMIC-exclusion test (it asserts `rollUpNational([indicator("ONI", 0.1), indicator("SEISMIC", 20)], TH, [], FOCUS)` stays GREEN). Add directly after that test:

```typescript
  it("daily rainfall + wind do NOT raise the national alert", () => {
    // A wet/dry week and a windy week with a neutral ocean must stay GREEN —
    // short-window local hazards drive their own gauges, never the ENSO alert.
    const status = rollUpNational(
      [
        indicator("ONI", 0.1),
        indicator("RAINFALL_DAILY", -80), // far below normal = drought band
        indicator("WIND_ANOM", 150), // 150% above normal = strong-wind band
      ],
      TH,
      [],
      FOCUS,
    );
    expect(status.alert_level).toBe("GREEN");
  });
```

> If `TH` (the test thresholds fixture) does not already include `RAINFALL_DAILY`/`WIND_ANOM` rows, the test still passes: NON_ALERT_KEYS excludes them BEFORE any threshold lookup, so the ocean-neutral ONI alone determines GREEN. No fixture change needed.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/risk-engine.test.ts -t "daily rainfall"`
Expected: FAIL — `alert_level` is not GREEN (the daily keys currently participate and escalate).

- [ ] **Step 3: Add both keys to NON_ALERT_KEYS**

In `src/lib/risk-engine.ts`, the `NON_ALERT_KEYS` set (currently lines 305-311) reads:

```typescript
  const NON_ALERT_KEYS = new Set([
    "PROJECTED_ONI",
    "MALARIA_INCIDENCE",
    "CPI_INFLATION",
    "FOOD_UNDERNOURISH",
    "SEISMIC",
  ]);
```

Replace it with (add the two keys + extend the comment above it — append this sentence to the existing block comment that ends at line 304: " RAINFALL_DAILY and WIND_ANOM are Open-Meteo 7-day local signals; they drive the Daily Watch gauges and per-province cells but a wet/windy week must not pin the national ENSO alert."):

```typescript
  const NON_ALERT_KEYS = new Set([
    "PROJECTED_ONI",
    "MALARIA_INCIDENCE",
    "CPI_INFLATION",
    "FOOD_UNDERNOURISH",
    "SEISMIC",
    "RAINFALL_DAILY",
    "WIND_ANOM",
  ]);
```

- [ ] **Step 4: Run the full engine suite**

Run: `npx vitest run tests/risk-engine.test.ts`
Expected: PASS — including the new test; no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/lib/risk-engine.ts tests/risk-engine.test.ts
git commit -m "feat: exclude daily rainfall + wind from the national ENSO alert"
```

---

## Task 5: Promote the two indicators in the orchestrator + storm Disaster rows

When Open-Meteo succeeds, always push the two new indicators (they are primary for their own keys), compute their trend with the self-date skip, append history, and emit per-province Disaster & Hazard rows when storms occurred.

**Files:**
- Modify: `ingest/lib.ts:262-278`

- [ ] **Step 1: Read the existing promote block**

The block at `ingest/lib.ts:262-278` promotes the rainfall backstop + temp. Confirm it ends with the `tempInd` push (`history.push({ key: tempInd.key, ... })`) and is inside `if (openMeteoRes.ok && openMeteoRes.value) { ... }`.

- [ ] **Step 2: Append the daily-indicator promotion inside that block**

Inside `if (openMeteoRes.ok && openMeteoRes.value) { ... }`, after the existing `tempInd` push and before the closing brace of that `if`, add:

```typescript
    // Daily-cadence Open-Meteo indicators — primary for their own keys (no
    // dekadal/monthly equivalent), so always promoted when the feed succeeded.
    const rainDaily = openMeteoRes.value.rainfall_daily_indicator;
    if (rainDaily.value !== null) {
      rainDaily.trend = computeTrend(rainDaily.key, rainDaily.value, history, 0.05, 0.05, rainDaily.observed_at);
      liveIndicators.push(rainDaily);
      history.push({ key: rainDaily.key, value: rainDaily.value, observed_at: rainDaily.observed_at });
    }
    const windAnom = openMeteoRes.value.wind_anom_indicator;
    if (windAnom.value !== null) {
      windAnom.trend = computeTrend(windAnom.key, windAnom.value, history, 0.05, 0.05, windAnom.observed_at);
      liveIndicators.push(windAnom);
      history.push({ key: windAnom.key, value: windAnom.value, observed_at: windAnom.observed_at });
    }
```

- [ ] **Step 3: Emit storm-day Disaster & Hazard rows**

The Open-Meteo `sector_rows` (Water Security, from rainfall) are pushed into `upstreamRows` at `ingest/lib.ts:342-343`, but only when the HDX rainfall primary failed. The storm rows are independent of that gate. Find the existing `upstreamRows.push(...openMeteoRes.value.sector_rows)` block (~line 342) and add, immediately after that block's closing brace:

```typescript
  // Storm-day Disaster & Hazard rows: when the recent week had storm-force gusts,
  // raise every focus province's Disaster cell. Independent of the rainfall gate
  // above — this is a wind-hazard signal, not a rainfall one.
  if (openMeteoRes.ok && openMeteoRes.value && openMeteoRes.value.storm_days > 0) {
    const sd = openMeteoRes.value.storm_days;
    const level: SectorRisk["level"] = sd >= 5 ? "high" : sd >= 3 ? "med" : "low";
    for (const code of FOCUS_CODES) {
      upstreamRows.push({
        province_code: code,
        sector: "Disaster & Hazard",
        level,
        score: Math.min(1, sd / 7),
        trend: "flat",
        provenance: "LIVE",
        as_of: new Date().toISOString(),
        data_source: `Open-Meteo · ${sd} storm-day${sd === 1 ? "" : "s"} / 7 (≥10.8 m/s)`,
      });
    }
  }
```

> `SectorRisk` is already imported in `ingest/lib.ts` (used by `existingSectorRisk`). If the type import is missing, add `SectorRisk` to the existing `import type { ... } from "../src/lib/types"` line.

- [ ] **Step 4: Typecheck + full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean typecheck; all tests pass (previous count + the new open-meteo + risk-engine tests).

- [ ] **Step 5: Commit**

```bash
git add ingest/lib.ts
git commit -m "feat: promote daily rainfall + wind indicators, emit storm Disaster rows"
```

---

## Task 6: UI metadata + Daily Watch sub-group

Add the gauge plain-language meta + cadence for both keys, and split the Climate page indicator grid into a "Daily Watch" sub-group and the rest.

**Files:**
- Modify: `src/lib/ui.ts:85-164` (INDICATOR_META), `src/lib/ui.ts:222-237` (SOURCE_CADENCE_DAYS)
- Modify: `src/app/climate/page.tsx`

- [ ] **Step 1: Add INDICATOR_META entries**

In `src/lib/ui.ts`, inside the `INDICATOR_META` object (after the `TRADE_WIND_ANOM` entry that ends ~line 139), add:

```typescript
  RAINFALL_DAILY: {
    plain:
      "Rainfall over the last 7 days versus normal (Open-Meteo, refreshed daily): the fast complement to the dekadal rainfall signal.",
    danger: "low",
    dangerLabel: "Falling / negative is dangerous: a fast-emerging dry spell.",
  },
  WIND_ANOM: {
    plain:
      "How strong the wind has run over the last 7 days versus normal (Open-Meteo, refreshed daily), with a count of storm-force days.",
    danger: "high",
    dangerLabel: "Rising is dangerous: stronger winds and more storm-days raise local hazard.",
  },
```

- [ ] **Step 2: Add SOURCE_CADENCE_DAYS entries**

In the `SOURCE_CADENCE_DAYS` map (~line 222), after the `TRADE_WIND_ANOM: 10,` line, add:

```typescript
  RAINFALL_DAILY: 8, // Open-Meteo daily, 5-day archive lag + grace
  WIND_ANOM: 8, // Open-Meteo daily, 5-day archive lag + grace
```

- [ ] **Step 3: Export the Daily-Watch key set**

At the end of `src/lib/ui.ts`, add an exported constant the page uses to partition indicators:

```typescript
// Indicators shown in the Climate page "Daily Watch" sub-group — daily-cadence
// Open-Meteo signals, visually separated from the dekadal/monthly indicators so
// a viewer never confuses the 7-day RAINFALL_DAILY with the dekadal RAINFALL_ANOM.
export const DAILY_WATCH_KEYS = new Set(["RAINFALL_DAILY", "WIND_ANOM"]);
```

- [ ] **Step 4: Partition the Climate page indicator grid**

In `src/app/climate/page.tsx`, add `DAILY_WATCH_KEYS` to the import from `@/lib/ui` (create the import if absent):

```typescript
import { DAILY_WATCH_KEYS } from "@/lib/ui";
```

After the `const oni = indicators.find(...)` line (~line 30), add the partition:

```typescript
  const dailyWatch = indicators.filter((i) => DAILY_WATCH_KEYS.has(i.key));
  const coreIndicators = indicators.filter((i) => !DAILY_WATCH_KEYS.has(i.key));
```

In the "Live indicators" `<section>`, change the grid to render `coreIndicators` instead of `indicators` (the `indicators.map` at ~line 64 becomes `coreIndicators.map`). Then, immediately after that `<section>` closes (~line 73), insert the new Daily Watch section:

```tsx
        {dailyWatch.length > 0 && (
          <section aria-label="Daily Watch">
            <SectionHeader
              title="Daily Watch · 7-day, refreshed daily"
              description="Fast-moving local signals from Open-Meteo, refreshed every cycle. These are a daily complement to the dekadal/monthly indicators above — they drive local hazard, not the national ENSO alert."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dailyWatch.map((i) => (
                <IndicatorGauge
                  key={i.key}
                  indicator={i}
                  threshold={thresholdByKey.get(i.key)}
                />
              ))}
            </div>
          </section>
        )}
```

> The 12-Month Trend section (~line 93) still maps over the full `indicators` array, so the daily indicators also appear as trend charts — correct, no change needed there.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Browser verification**

Start the dev server and verify the Climate page renders the Daily Watch group.

- preview_start (if no server running), then navigate to `/climate`.
- preview_console_logs — expect no errors.
- preview_snapshot — confirm a "Daily Watch · 7-day, refreshed daily" heading exists with two gauges (Rainfall 7-day, Wind anomaly), each with a LIVE badge, AND that the original "Indicators" group no longer contains RAINFALL_DAILY/WIND_ANOM.
- preview_screenshot — capture the Daily Watch group as proof.

> If `/data/indicators.json` does not yet contain `RAINFALL_DAILY`/`WIND_ANOM` (no live ingest has run since Task 5), the Daily Watch group will be empty/hidden. To verify rendering, either run a live ingest (`npx tsx ingest/run.ts` or the project's ingest entrypoint — check `ingest/` for the runner) or temporarily add two fixture rows to `data/indicators.json` for the screenshot, then revert them. Do NOT commit fixture rows.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ui.ts src/app/climate/page.tsx
git commit -m "feat: Daily Watch sub-group on the Climate page for daily rainfall + wind"
```

---

## Task 7: Live ingest + final verification

Run a real ingest so the committed data carries the new indicators, then verify end-to-end.

**Files:**
- Modify (data, via ingest): `data/indicators.json`, `data/readings_history.json`, `data/sector_risk.json`, `data/national_status.json`, `data/last_run.json`

- [ ] **Step 1: Find + run the ingest entrypoint**

Check `ingest/` for the CLI runner (likely `ingest/run.ts` or referenced in `package.json` scripts). Run it:

```bash
cat package.json | grep -A2 '"scripts"' && ls ingest/*.ts | grep -iv "lib\|io\|geo\|sources"
```

Then run the discovered entrypoint (example — replace with the real one):

```bash
npx tsx ingest/run.ts
```

Expected: completes, prints a run summary including the new indicators, and rewrites the `data/*.json` files. Takes ~3–5 minutes (live feeds).

- [ ] **Step 2: Verify the new indicators landed LIVE**

Run:

```bash
node -e "const i=require('./data/indicators.json'); for(const k of ['RAINFALL_DAILY','WIND_ANOM']){const x=i.find(d=>d.key===k); console.log(k, x?('prov '+x.provenance+' val '+x.value+' trend '+x.trend+' @'+x.observed_at):'ABSENT');}"
```

Expected: both present, `prov LIVE`, a numeric value, a real `observed_at`.

- [ ] **Step 3: Verify the national alert did not move on the daily signals**

Run:

```bash
node -e "const n=require('./data/national_status.json'); console.log('alert_level', n.alert_level, 'enso_phase', n.enso_phase);"
```

Expected: `alert_level` reflects only the ENSO spine (ONI/SOI/trade-wind/soil) — it must NOT have escalated purely because of `RAINFALL_DAILY`/`WIND_ANOM`. (Cross-check: if the value changed vs before, confirm an ENSO-spine indicator drove it, not a daily key.)

- [ ] **Step 4: Full verification gate**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean typecheck; all tests pass.

- [ ] **Step 5: Commit the regenerated data + push + verify sync**

```bash
git add data/indicators.json data/readings_history.json data/sector_risk.json data/national_status.json data/last_run.json
git commit -m "data: ingest cycle with daily rainfall + wind indicators live"
git push
git status -sb && git rev-parse HEAD @{u}
```

Expected: clean tree; the two SHAs (HEAD and upstream) identical.

---

## Self-Review

**1. Spec coverage:**
- RAINFALL_DAILY + WIND_ANOM indicators → Tasks 2, 6, 7. ✓
- 7-day window vs 8-yr normal → Task 2 Step 3. ✓
- Storm-day count, cutoff 10.8 m/s, config-driven → Tasks 1, 3, 2. ✓
- CHIRPS + NOAA trade-wind untouched → no task modifies them; RAINFALL_ANOM formula refactor preserves value (Task 2 Step 3 note). ✓
- NON_ALERT_KEYS exclusion → Task 4. ✓
- Storm-days escalate per-province Disaster & Hazard → Task 5 Step 3. ✓
- Daily Watch sub-group on the climate page → Task 6 (note: spec said "/forecast"; the actual climate page is `src/app/climate/page.tsx` — corrected here). ✓
- ui.ts meta + cadence → Task 6 (spec mentioned a "sparkline range map" that does not exist in ui.ts; only INDICATOR_META + SOURCE_CADENCE_DAYS exist — corrected, no phantom map). ✓
- Error handling (degrade, partial, no fake freshness) → existing mechanisms reused: promote is gated on `value !== null`; partial handled by averaging over `results`; observed_at is a real timestamp. ✓
- Tests (storm-day, anomaly %, NON_ALERT_KEYS exclusion) → Tasks 1 + 4. ✓
- File-size guard: open-meteo.ts will grow ~80 lines (197 → ~280), staying under 400, so no split needed — the spec's conditional split is not triggered. ✓

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". Each code step shows full code. The one variable element (ingest entrypoint path) has an explicit discovery command. ✓

**3. Type consistency:** `anomalyPct`, `countStormDays`, `STORM_DAY_MS` defined in Task 1 and used in Task 2. `OpenMeteoResult` fields (`rainfall_daily_indicator`, `wind_anom_indicator`, `storm_days`) defined in Task 2 and consumed in Task 5. Keys `RAINFALL_DAILY`/`WIND_ANOM` consistent across Tasks 2–7. `DAILY_WATCH_KEYS` defined in Task 6 Step 3, used in Step 4. ✓
