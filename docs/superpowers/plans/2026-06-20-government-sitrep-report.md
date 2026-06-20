# Government SITREP Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Weekly SITREP (HTML + .docx) to a government-grade report — exec-first layout, four server-side SVG visuals, plain-language data confidence, and a Technical appendix replacing the engineer footer dump.

**Architecture:** The SITREP renders two ways (standalone print-HTML + editable .docx) from one `SitrepModel`. Dashboard visuals are React-only, so every visual is rebuilt as a pure server-side SVG-string builder. HTML embeds the SVG inline; docx rasterizes SVG→PNG via `@resvg/resvg-js` and embeds the PNG. Plain-language vocabulary trapped in React components is extracted to a shared pure module so the dashboard and SITREP share one source of truth.

**Tech Stack:** Next.js 16 / React 19, TypeScript, vitest 4 (`pnpm vitest run`), `docx` library, `@resvg/resvg-js` (new), pnpm.

**Spec:** `docs/superpowers/specs/2026-06-20-government-sitrep-report-design.md`

**Conventions:**
- Run a single test file: `pnpm vitest run tests/<name>.test.ts`
- Typecheck: `npx tsc --noEmit` · Lint: `pnpm lint` · Build: `pnpm build`
- After EVERY task: commit AND push, then verify `git status -sb` clean and `git rev-parse HEAD @{u}` returns identical SHAs.
- Keep every file under 500 lines.

---

### Task 1: Install the SVG rasterizer

**Files:**
- Modify: `package.json` (dependency added by pnpm)
- Modify: `pnpm-lock.yaml` (by pnpm)

- [ ] **Step 1: Add the dependency**

```bash
pnpm add @resvg/resvg-js
```

- [ ] **Step 2: Verify it imports in the Node test env**

Create a throwaway check (delete after):

```bash
node -e "const {Resvg}=require('@resvg/resvg-js'); const r=new Resvg('<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\"><rect width=\"10\" height=\"10\" fill=\"red\"/></svg>'); const p=r.render().asPng(); console.log('PNG bytes:', p.length>0);"
```

Expected: `PNG bytes: true`

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build: add @resvg/resvg-js for SITREP SVG→PNG rasterization"
git push && git status -sb && git rev-parse HEAD @{u}
```

---

### Task 2: Extract plain-language vocabulary to `national-language.ts`

The bottom-line sentence, phase explanations, alert actions and KPI sublabels currently live inside `ExecutiveHeadline.tsx` and `KpiStrip.tsx`. Extract verbatim so the server SITREP and the dashboard share one source.

**Files:**
- Create: `src/lib/national-language.ts`
- Test: `tests/national-language.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/national-language.test.ts
import { describe, it, expect } from "vitest";
import {
  PHASE_PLAIN,
  ALERT_ACTION,
  bottomLineSentence,
} from "../src/lib/national-language";
import type { NationalStatus } from "../src/lib/types";

function ns(over: Partial<NationalStatus> = {}): NationalStatus {
  return {
    enso_phase: "neutral",
    alert_level: "AMBER",
    national_risk_rating: "med",
    affected_population_est: 1_000_000,
    high_risk_province_count: 0,
    forecast_period: "Next 3 months",
    updated_at: "2026-06-20T00:00:00.000Z",
    ...over,
  };
}

describe("national-language", () => {
  it("phase plain text matches the dashboard wording", () => {
    expect(PHASE_PLAIN.neutral).toBe(
      "The Pacific is in a neutral state (no El Niño or La Niña)",
    );
    expect(PHASE_PLAIN.el_nino_alert).toBe(
      "An El Niño is underway (highland drought & frost likely)",
    );
  });

  it("alert action matches the dashboard wording", () => {
    expect(ALERT_ACTION.AMBER).toBe("Brief sector leads and verify cluster readiness.");
    expect(ALERT_ACTION.BLACK).toBe("Activate the National Emergency Operations Centre now.");
  });

  it("bottom line ends with a period when no provinces are stressed", () => {
    const s = bottomLineSentence(ns({ enso_phase: "neutral", alert_level: "AMBER", national_risk_rating: "med", high_risk_province_count: 0 }));
    expect(s).toBe(
      "The Pacific is in a neutral state (no El Niño or La Niña), but the national alert is AMBER and overall risk is MED.",
    );
  });

  it("bottom line appends the stressed-province clause", () => {
    const s = bottomLineSentence(ns({ enso_phase: "el_nino_alert", alert_level: "RED", national_risk_rating: "high", high_risk_province_count: 3 }));
    expect(s).toBe(
      "An El Niño is underway (highland drought & frost likely), but the national alert is RED and overall risk is HIGH — 3 of the 4 focus provinces are stressed across multiple sectors.",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/national-language.test.ts`
Expected: FAIL — cannot find module `../src/lib/national-language`.

- [ ] **Step 3: Write the module**

```typescript
// src/lib/national-language.ts
// Plain-language vocabulary for the national picture, written for non-technical
// readers (officers, executives, the PM). Lives in ONE pure module so the
// dashboard (ExecutiveHeadline, KpiStrip) and the server-rendered SITREP read
// from the same source and can never drift. No React, no I/O.
import type { NationalStatus, AlertLevel } from "./types";
import { FOCUS_COUNT } from "./focus-provinces";

// What each ENSO phase means for PNG, in one sentence — the science made plain.
export const PHASE_PLAIN: Record<NationalStatus["enso_phase"], string> = {
  neutral: "The Pacific is in a neutral state (no El Niño or La Niña)",
  el_nino_watch: "An El Niño is building (drought/frost risk rising)",
  el_nino_alert: "An El Niño is underway (highland drought & frost likely)",
  la_nina_watch: "A La Niña is building (flood risk rising)",
  la_nina_alert: "A La Niña is underway (heavy rain & flooding likely)",
};

// The single instruction to leadership for each alert level.
export const ALERT_ACTION: Record<AlertLevel, string> = {
  GREEN: "Maintain routine monitoring.",
  AMBER: "Brief sector leads and verify cluster readiness.",
  RED: "Pre-position water and health supplies and issue advisories to the focus provinces.",
  BLACK: "Activate the National Emergency Operations Centre now.",
};

// The one sentence the Prime Minister reads first: what's happening, how bad, and
// — when provinces are stressed — how widespread. The recommended action
// (ALERT_ACTION) is appended by the caller so it can be styled separately.
export function bottomLineSentence(national: NationalStatus): string {
  const level = national.alert_level;
  const risk = national.national_risk_rating.toUpperCase();
  const provinces = national.high_risk_province_count;
  return (
    `${PHASE_PLAIN[national.enso_phase]}, but the national alert is ` +
    `${level} and overall risk is ${risk}` +
    (provinces > 0
      ? ` — ${provinces} of the ${FOCUS_COUNT} focus provinces are stressed across multiple sectors.`
      : ".")
  );
}

// Short plain hint shown under each KPI card. Sourced from KpiStrip so the SITREP
// KPI band and the dashboard tiles explain each metric identically.
export const PHASE_HINT: Record<NationalStatus["enso_phase"], string> = {
  neutral: "Pacific in a normal state — no El Niño or La Niña forcing.",
  el_nino_watch: "Conditions building toward El Niño — drought/frost risk rising.",
  el_nino_alert: "El Niño underway — highland drought & frost likely.",
  la_nina_watch: "Conditions building toward La Niña — flood risk rising.",
  la_nina_alert: "La Niña underway — heavy rain & flooding likely.",
};

export const ALERT_HINT: Record<AlertLevel, string> = {
  GREEN: "Routine — normal monitoring.",
  AMBER: "Watch — brief sector leads, verify readiness.",
  RED: "Alert — pre-position supplies, advise focus provinces.",
  BLACK: "Emergency — activate national operations centre.",
};

export const RISK_HINT: Record<NationalStatus["national_risk_rating"], string> = {
  low: "Few sectors stressed across focus provinces.",
  med: "Several sectors stressed — monitor closely.",
  high: "Many sectors stressed — action needed now.",
  critical: "Widespread severe stress — crisis footing.",
};

// Short phase label for the KPI band cell (not the full sentence).
export const PHASE_SHORT: Record<NationalStatus["enso_phase"], string> = {
  neutral: "Neutral",
  el_nino_watch: "El Niño Watch",
  el_nino_alert: "El Niño Alert",
  la_nina_watch: "La Niña Watch",
  la_nina_alert: "La Niña Alert",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/national-language.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Refactor `ExecutiveHeadline.tsx` to import the shared module**

Replace its local `PHASE_PLAIN`, `ACTION`, and the inline `sentence` construction. New file:

```tsx
// src/components/ExecutiveHeadline.tsx
// The one sentence the Prime Minister reads first. Synthesises the national
// status into plain English — "what's happening, how bad, what to do" — so a
// non-technical leader gets the bottom line before scanning any tile or matrix.
// Plain-language wording lives in src/lib/national-language.ts (shared with the
// server-rendered SITREP) so the two can never drift.
import type { NationalStatus } from "@/lib/types";
import { ALERT_ACTION, bottomLineSentence } from "@/lib/national-language";
import { StatusPill } from "./ui";
import { AlertTriangle } from "lucide-react";

const ALERT_STATUS = { GREEN: "green", AMBER: "amber", RED: "red", BLACK: "black" } as const;

export function ExecutiveHeadline({ national }: { national: NationalStatus | null }) {
  if (!national) return null;

  const level = national.alert_level;
  const sentence = bottomLineSentence(national);

  return (
    <div className="rounded-lg border border-border-default bg-surface-1 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-2 shrink-0">
        <AlertTriangle size={16} className="text-status-red" />
        <span className="text-[10px] uppercase tracking-[0.12em] text-text-muted font-semibold">
          Bottom line
        </span>
        <StatusPill status={ALERT_STATUS[level]} size="sm" pulse={level === "RED" || level === "BLACK"}>
          {level}
        </StatusPill>
      </div>
      <p className="text-sm text-text-1 leading-relaxed">
        {sentence}{" "}
        <span className="text-text-2 font-medium">{ALERT_ACTION[level]}</span>
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Refactor `KpiStrip.tsx` to import the shared hints**

In `src/components/KpiStrip.tsx`, delete the local `PHASE_SHORT`, `PHASE_HINT`, `ALERT_HINT`, `RISK_HINT` consts (lines ~10–41) and import them instead. Change the import block near the top to add:

```tsx
import {
  PHASE_SHORT,
  PHASE_HINT,
  ALERT_HINT,
  RISK_HINT,
} from "@/lib/national-language";
```

Keep `ALERT_TONE`, `RISK_TONE`, `PHASE_TONE` local (they are colour-mapping, not language). The JSX is unchanged — it already references `PHASE_SHORT`, `PHASE_HINT[…]`, `ALERT_HINT[…]`, `RISK_HINT[…]`.

- [ ] **Step 7: Typecheck, lint, run the dashboard test suite**

Run: `npx tsc --noEmit && pnpm lint && pnpm vitest run`
Expected: PASS — no type errors, lint clean, all existing tests green (the refactor is constant-moving only; render output is byte-identical).

- [ ] **Step 8: Commit**

```bash
git add src/lib/national-language.ts tests/national-language.test.ts src/components/ExecutiveHeadline.tsx src/components/KpiStrip.tsx
git commit -m "refactor: extract national plain-language vocab to shared module"
git push && git status -sb && git rev-parse HEAD @{u}
```

---

### Task 3: Data-confidence module (`data-confidence.ts`)

Replaces the engineer footer dump with a plain-English confidence line. The raw OK/FAIL list is preserved for the Technical appendix only.

**Files:**
- Create: `src/lib/data-confidence.ts`
- Test: `tests/data-confidence.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/data-confidence.test.ts
import { describe, it, expect } from "vitest";
import { dataConfidence } from "../src/lib/data-confidence";
import type { LastRun } from "../src/lib/types";

function lastRun(sources: Record<string, boolean>): LastRun {
  return {
    started_at: "2026-06-20T00:00:00.000Z",
    finished_at: "2026-06-20T00:05:00.000Z",
    status: "partial",
    sources_ok: sources,
    notes: "",
  };
}

describe("dataConfidence", () => {
  it("GOOD when at least 75% of feeds reported", () => {
    const r = dataConfidence(lastRun({ a: true, b: true, c: true, d: false }));
    expect(r.level).toBe("GOOD");
    expect(r.line).toContain("3 of 4 data feeds reported");
    expect(r.line).toContain("DEMO");
    expect(r.feeds).toEqual([
      { name: "a", ok: true },
      { name: "b", ok: true },
      { name: "c", ok: true },
      { name: "d", ok: false },
    ]);
  });

  it("PARTIAL between 40% and 75%", () => {
    const r = dataConfidence(lastRun({ a: true, b: false, c: false }));
    expect(r.level).toBe("PARTIAL");
    expect(r.line).toContain("1 of 3 data feeds reported");
  });

  it("LOW below 40%", () => {
    const r = dataConfidence(lastRun({ a: true, b: false, c: false, d: false, e: false }));
    expect(r.level).toBe("LOW");
  });

  it("LOW with a null run", () => {
    const r = dataConfidence(null);
    expect(r.level).toBe("LOW");
    expect(r.feeds).toEqual([]);
    expect(r.line).toContain("No ingest run");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/data-confidence.test.ts`
Expected: FAIL — cannot find module `../src/lib/data-confidence`.

- [ ] **Step 3: Write the module**

```typescript
// src/lib/data-confidence.ts
// Turns the raw ingest-feed health (last_run.sources_ok) into ONE plain-English
// confidence line for non-technical readers — replacing the engineer "feed: FAIL"
// dump that used to sit in the SITREP footer. The raw OK/FAIL list is still
// returned (feeds[]) but is surfaced only in the Technical appendix.
import type { LastRun } from "./types";

export interface DataConfidence {
  level: "GOOD" | "PARTIAL" | "LOW";
  line: string;
  feeds: { name: string; ok: boolean }[];
}

export function dataConfidence(lastRun: LastRun | null): DataConfidence {
  const feeds = Object.entries(lastRun?.sources_ok ?? {}).map(([name, ok]) => ({
    name,
    ok,
  }));

  if (feeds.length === 0) {
    return {
      level: "LOW",
      line:
        "No ingest run has reported this cycle. Figures shown are the last known values; " +
        "figures marked DEMO are seeded references pending a live feed.",
      feeds: [],
    };
  }

  const okCount = feeds.filter((f) => f.ok).length;
  const share = okCount / feeds.length;
  const level: DataConfidence["level"] =
    share >= 0.75 ? "GOOD" : share >= 0.4 ? "PARTIAL" : "LOW";

  const line =
    `${okCount} of ${feeds.length} data feeds reported this cycle. ` +
    "Figures marked DEMO are seeded references shown pending a live feed.";

  return { level, line, feeds };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/data-confidence.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data-confidence.ts tests/data-confidence.test.ts
git commit -m "feat: plain-English data-confidence line for the SITREP"
git push && git status -sb && git rev-parse HEAD @{u}
```

---

### Task 4: Province GeoJSON type + reader

The provincial map needs the province geometry. It lives in `public/provinces.geojson` (NOT `data/`), so it needs its own reader.

**Files:**
- Modify: `src/lib/types.ts` (add `ProvinceFC`)
- Modify: `src/lib/data.ts` (add `getProvincesGeojson`)
- Test: `tests/data-geojson.test.ts`

- [ ] **Step 1: Add the `ProvinceFC` type to `types.ts`**

Append after the existing `ProvinceProperties` interface (end of file):

```typescript
// Minimal GeoJSON shape for the provincial map — a FeatureCollection of
// MultiPolygon features carrying ProvinceProperties. Coordinates are
// [lon, lat] rings. Kept local (no geojson dependency) — the SITREP map
// builder only needs to project these rings to SVG paths.
export interface ProvinceFeature {
  type: "Feature";
  properties: ProvinceProperties;
  geometry: {
    type: "MultiPolygon";
    coordinates: number[][][][]; // [polygon][ring][point][lon,lat]
  };
}

export interface ProvinceFC {
  type: "FeatureCollection";
  features: ProvinceFeature[];
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// tests/data-geojson.test.ts
import { describe, it, expect } from "vitest";
import { getProvincesGeojson } from "../src/lib/data";

describe("getProvincesGeojson", () => {
  it("reads public/provinces.geojson as a FeatureCollection of provinces", async () => {
    const fc = await getProvincesGeojson();
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features.length).toBeGreaterThanOrEqual(22);
    const f = fc.features[0];
    expect(f.geometry.type).toBe("MultiPolygon");
    expect(typeof f.properties.code).toBe("string");
    expect(typeof f.properties.name).toBe("string");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run tests/data-geojson.test.ts`
Expected: FAIL — `getProvincesGeojson` is not exported.

- [ ] **Step 4: Add the reader to `data.ts`**

Add `ProvinceFC` to the type import block at the top of `src/lib/data.ts` (the `import type { … } from "./types"` list). Then append after `getForecast`:

```typescript
// Province geometry lives in /public (served statically to the browser map), not
// /data — so it needs its own reader. Read once server-side for the SITREP
// provincial map. Empty FeatureCollection on failure so the map degrades to a
// "no geometry" note rather than crashing the report.
const PUBLIC_DIR = path.join(process.cwd(), "public");

export async function getProvincesGeojson(): Promise<ProvinceFC> {
  try {
    const buf = await fs.readFile(path.join(PUBLIC_DIR, "provinces.geojson"), "utf8");
    return JSON.parse(buf) as ProvinceFC;
  } catch {
    return { type: "FeatureCollection", features: [] };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/data-geojson.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/data.ts tests/data-geojson.test.ts
git commit -m "feat: ProvinceFC type and getProvincesGeojson reader for the SITREP map"
git push && git status -sb && git rev-parse HEAD @{u}
```

---

### Task 5: SVG visual builders — shared helpers + KPI band

Pure SVG-string builders. Start with shared helpers and the KPI band. Inline attributes only (no external CSS) so the SVG survives both standalone HTML and rasterization.

**Files:**
- Create: `src/lib/sitrep-visuals.ts`
- Test: `tests/sitrep-visuals.test.ts`

- [ ] **Step 1: Write the failing test (KPI band + shared escape)**

```typescript
// tests/sitrep-visuals.test.ts
import { describe, it, expect } from "vitest";
import { kpiBandSvg } from "../src/lib/sitrep-visuals";
import type { NationalStatus } from "../src/lib/types";

function ns(over: Partial<NationalStatus> = {}): NationalStatus {
  return {
    enso_phase: "neutral",
    alert_level: "AMBER",
    national_risk_rating: "med",
    affected_population_est: 1_795_581,
    high_risk_province_count: 3,
    forecast_period: "Next 3 months",
    updated_at: "2026-06-20T00:00:00.000Z",
    ...over,
  };
}

describe("kpiBandSvg", () => {
  it("returns an svg containing the alert level and a grouped population", () => {
    const svg = kpiBandSvg(ns());
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("AMBER");
    expect(svg).toContain("1,795,581");
    expect(svg).toContain("Next 3 months");
  });

  it("renders a single fallback cell when national is null", () => {
    const svg = kpiBandSvg(null);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("No national status");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/sitrep-visuals.test.ts`
Expected: FAIL — cannot find module `../src/lib/sitrep-visuals`.

- [ ] **Step 3: Write shared helpers + `kpiBandSvg`**

```typescript
// src/lib/sitrep-visuals.ts
// Pure server-side SVG builders for the SITREP. The dashboard's visuals are
// React/client components and cannot be used in standalone HTML or in Word — so
// every report visual is rebuilt here as a plain SVG string: data in, SVG out.
// Inline attributes only (no external CSS) so the markup survives BOTH inline
// embedding in the print HTML and rasterization to PNG for the .docx.
import type {
  NationalStatus,
  SectorRisk,
  RiskLevel,
  Indicator,
  HistoricalReading,
  ProvinceFC,
} from "./types";
import { RISK_COLOUR, ALERT_COLOUR } from "./ui";
import { FOCUS_CODES, FOCUS_SHORT_LABELS } from "./focus-provinces";
import { PHASE_SHORT } from "./national-language";

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

export { legendStrip, svgRoot, groupThousands, INK, MUTED, LINE };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/sitrep-visuals.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sitrep-visuals.ts tests/sitrep-visuals.test.ts
git commit -m "feat: SITREP SVG builders — shared helpers + executive KPI band"
git push && git status -sb && git rev-parse HEAD @{u}
```

---

### Task 6: Risk-matrix SVG builder

**Files:**
- Modify: `src/lib/sitrep-visuals.ts`
- Modify: `tests/sitrep-visuals.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `tests/sitrep-visuals.test.ts`:

```typescript
import { riskMatrixSvg } from "../src/lib/sitrep-visuals";
import type { SectorRisk } from "../src/lib/types";

function sr(over: Partial<SectorRisk> = {}): SectorRisk {
  return {
    province_code: "PG-EN",
    sector: "Food Security",
    level: "critical",
    score: 0.9,
    trend: "up",
    provenance: "LIVE",
    as_of: "2026-06-20",
    ...over,
  };
}

describe("riskMatrixSvg", () => {
  it("renders an svg with the critical colour and a sector label", () => {
    const svg = riskMatrixSvg([sr()]);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("#334155"); // RISK_COLOUR.critical
    expect(svg).toContain("Food Security");
    expect(svg).toContain("National");
  });

  it("renders a note when there are no cells", () => {
    const svg = riskMatrixSvg([]);
    expect(svg).toContain("No sector cells");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/sitrep-visuals.test.ts`
Expected: FAIL — `riskMatrixSvg` is not exported.

- [ ] **Step 3: Implement `riskMatrixSvg`**

Append to `src/lib/sitrep-visuals.ts` (before the final `export { … }` line, then add `riskMatrixSvg` to that export is unnecessary since it's exported inline):

```typescript
// --- Risk matrix ------------------------------------------------------------

import type { Sector } from "./types";

const SECTORS: Sector[] = [
  "Food Security",
  "Water Security",
  "Public Health",
  "Economic Stability",
  "Infrastructure",
  "Energy Security",
  "Social Stability",
];

const LEVEL_RANK: Record<RiskLevel, number> = { low: 0, med: 1, high: 2, critical: 3 };

function worstLevel(rows: SectorRisk[]): RiskLevel | null {
  if (!rows.length) return null;
  return rows.reduce<RiskLevel>(
    (acc, r) => (LEVEL_RANK[r.level] > LEVEL_RANK[acc] ? r.level : acc),
    "low",
  );
}

// Rows = the 7 sectors. Columns = a leading National column (the sector's worst
// level across the focus provinces) then one column per focus province. Each
// cell is a traffic-light square; the National cell also shows a count of focus
// provinces at HIGH/CRITICAL for that sector. Legend strip beneath.
export function riskMatrixSvg(sectorRisk: SectorRisk[]): string {
  const focusRisk = sectorRisk.filter((r) => FOCUS_CODES.includes(r.province_code));
  if (!focusRisk.length) {
    return svgRoot(
      600,
      80,
      `<text x="300" y="46" text-anchor="middle" font-size="14" fill="${MUTED}">No sector cells this cycle.</text>`,
    );
  }

  const cols = ["National", ...FOCUS_CODES];
  const labelW = 150;
  const cellW = 84;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/sitrep-visuals.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sitrep-visuals.ts tests/sitrep-visuals.test.ts
git commit -m "feat: SITREP national risk-matrix SVG builder"
git push && git status -sb && git rev-parse HEAD @{u}
```

---

### Task 7: Indicator trend-chart SVG builder

**Files:**
- Modify: `src/lib/sitrep-visuals.ts`
- Modify: `tests/sitrep-visuals.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `tests/sitrep-visuals.test.ts`:

```typescript
import { trendChartSvg } from "../src/lib/sitrep-visuals";
import type { Indicator, HistoricalReading } from "../src/lib/types";

function ind(key: string, label: string): Indicator {
  return {
    key,
    label,
    unit: "",
    source: "NOAA",
    update_frequency: "monthly",
    provenance: "LIVE",
    value: 1,
    observed_at: "2026-06-01",
    trend: "up",
  };
}

describe("trendChartSvg", () => {
  it("draws a mini chart for an indicator with >=2 readings and skips one with <2", () => {
    const indicators = [ind("ONI", "Oceanic Niño Index"), ind("SOI", "Southern Oscillation")];
    const history: HistoricalReading[] = [
      { key: "ONI", value: 0.1, observed_at: "2026-01-01" },
      { key: "ONI", value: 0.4, observed_at: "2026-02-01" },
      { key: "ONI", value: 0.8, observed_at: "2026-03-01" },
      { key: "SOI", value: -1, observed_at: "2026-03-01" }, // only 1 point → skipped
    ];
    const svg = trendChartSvg(history, indicators);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("Oceanic Niño Index");
    expect(svg).not.toContain("Southern Oscillation");
  });

  it("renders a note when no indicator has enough history", () => {
    const svg = trendChartSvg([], [ind("ONI", "Oceanic Niño Index")]);
    expect(svg).toContain("No trend history");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/sitrep-visuals.test.ts`
Expected: FAIL — `trendChartSvg` is not exported.

- [ ] **Step 3: Implement `trendChartSvg`**

Append to `src/lib/sitrep-visuals.ts`:

```typescript
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
  const ch = 130;
  const pad = 12;
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
    const plotH = ch - 44;
    const px = ox + pad;
    const py = oy + 28;

    const vals = s.pts.map((p) => p.value);
    let min = Math.min(0, ...vals);
    let max = Math.max(0, ...vals);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const sx = (idx: number) => px + (idx / (s.pts.length - 1)) * plotW;
    const sy = (v: number) => py + plotH - ((v - min) / (max - min)) * plotH;

    // Title.
    body += `<text x="${ox + pad}" y="${oy + 16}" font-size="12" font-weight="600" fill="${INK}">${svgEsc(s.ind.label)}</text>`;
    // Frame + zero baseline.
    body += `<rect x="${px}" y="${py}" width="${plotW}" height="${plotH}" fill="#fafafa" stroke="${LINE}"/>`;
    if (min < 0 && max > 0) {
      const zy = sy(0);
      body += `<line x1="${px}" y1="${zy}" x2="${px + plotW}" y2="${zy}" stroke="#d4d4d8" stroke-dasharray="3 3"/>`;
    }
    // Line.
    const d = s.pts.map((p, idx) => `${idx === 0 ? "M" : "L"}${sx(idx).toFixed(1)},${sy(p.value).toFixed(1)}`).join(" ");
    body += `<path d="${d}" fill="none" stroke="#2563eb" stroke-width="2"/>`;
    // Latest value label.
    const last = s.pts[s.pts.length - 1];
    body += `<circle cx="${sx(s.pts.length - 1).toFixed(1)}" cy="${sy(last.value).toFixed(1)}" r="3" fill="#2563eb"/>`;
    body += `<text x="${ox + cw - pad}" y="${oy + 16}" text-anchor="end" font-size="12" font-weight="700" fill="#2563eb">${last.value}</text>`;
  });

  return svgRoot(W, H, body);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/sitrep-visuals.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sitrep-visuals.ts tests/sitrep-visuals.test.ts
git commit -m "feat: SITREP indicator trend-chart SVG builder"
git push && git status -sb && git rev-parse HEAD @{u}
```

---

### Task 8: Provincial-map SVG builder

**Files:**
- Modify: `src/lib/sitrep-visuals.ts`
- Modify: `tests/sitrep-visuals.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `tests/sitrep-visuals.test.ts`:

```typescript
import { provincialMapSvg } from "../src/lib/sitrep-visuals";
import type { ProvinceFC } from "../src/lib/types";

const fc: ProvinceFC = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { code: "PG-EN", name: "Enga", is_focus: true, population: 432000 },
      geometry: { type: "MultiPolygon", coordinates: [[[[143, -5], [144, -5], [144, -6], [143, -6], [143, -5]]]] },
    },
    {
      type: "Feature",
      properties: { code: "PG-WHM", name: "Western Highlands", is_focus: true, population: 362000 },
      geometry: { type: "MultiPolygon", coordinates: [[[[144, -5], [145, -5], [145, -6], [144, -6], [144, -5]]]] },
    },
  ],
};

describe("provincialMapSvg", () => {
  it("draws one path per province, coloured by worst sector level", () => {
    const svg = provincialMapSvg(fc, [
      { province_code: "PG-EN", sector: "Food Security", level: "critical", score: 0.9, trend: "up", provenance: "LIVE", as_of: "2026-06-20" },
    ]);
    expect(svg.startsWith("<svg")).toBe(true);
    expect((svg.match(/<path /g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(svg).toContain("#334155"); // Enga critical fill
  });

  it("renders a note for an empty FeatureCollection", () => {
    const svg = provincialMapSvg({ type: "FeatureCollection", features: [] }, []);
    expect(svg).toContain("No province geometry");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/sitrep-visuals.test.ts`
Expected: FAIL — `provincialMapSvg` is not exported.

- [ ] **Step 3: Implement `provincialMapSvg`**

Append to `src/lib/sitrep-visuals.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/sitrep-visuals.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Check the file size budget**

Run: `wc -l src/lib/sitrep-visuals.ts`
Expected: under 500. If it exceeds 500, split into `src/lib/sitrep-visuals/{shared,kpi,matrix,trends,map}.ts` with a barrel `src/lib/sitrep-visuals/index.ts` re-exporting all four builders, moving the shared helpers (`svgEsc`, `svgRoot`, `legendStrip`, `groupThousands`, palette consts, `LEVEL_RANK`, `SECTORS`, `worstLevel`) into `shared.ts`. Keep the import path `@/lib/sitrep-visuals` stable via the barrel. Re-run the test suite after the split.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sitrep-visuals.ts tests/sitrep-visuals.test.ts
git commit -m "feat: SITREP provincial-risk map SVG builder"
git push && git status -sb && git rev-parse HEAD @{u}
```

---

### Task 9: SVG→PNG rasterizer (`sitrep-raster.ts`)

**Files:**
- Create: `src/lib/sitrep-raster.ts`
- Test: `tests/sitrep-raster.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/sitrep-raster.test.ts
import { describe, it, expect } from "vitest";
import { svgToPng } from "../src/lib/sitrep-raster";

describe("svgToPng", () => {
  it("rasterizes an svg to a non-empty PNG buffer", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20"><rect width="20" height="20" fill="#22c55e"/></svg>';
    const png = await svgToPng(svg, 200);
    expect(png.length).toBeGreaterThan(0);
    // PNG magic number.
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/sitrep-raster.test.ts`
Expected: FAIL — cannot find module `../src/lib/sitrep-raster`.

- [ ] **Step 3: Write the module**

```typescript
// src/lib/sitrep-raster.ts
// SVG → PNG for the .docx report. Word embeds PNG reliably across versions
// (including older government installs where native SVG-in-Word fails), so each
// SITREP visual is rasterized here before going into the document. Node-only
// (wraps @resvg/resvg-js native bindings) — isolated from the pure SVG builders
// so those stay testable without the native module.
import { Resvg } from "@resvg/resvg-js";

// Rasterize at a target pixel width; height follows the SVG's aspect ratio.
// `width` should be ~2× the on-page render width for crisp print output.
export async function svgToPng(svg: string, width: number): Promise<Buffer> {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    background: "#ffffff",
  });
  return Buffer.from(resvg.render().asPng());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/sitrep-raster.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sitrep-raster.ts tests/sitrep-raster.test.ts
git commit -m "feat: SVG→PNG rasterizer for the SITREP .docx export"
git push && git status -sb && git rev-parse HEAD @{u}
```

---

### Task 10: Extend the model (confidence + bottomLine) and `buildSitrepModel`

The model must carry the new exec-first text fields without storing the heavy SVG strings.

**Files:**
- Modify: `src/lib/types.ts` (SitrepModel)
- Modify: `src/lib/sitrep.ts` (SitrepInputs, buildSitrepModel)
- Modify: `tests/sitrep.test.ts`

- [ ] **Step 1: Add fields to `SitrepModel` in `types.ts`**

In the `SitrepModel` interface, after `actions: string[];` and before the `strategic` block, add:

```typescript
  // Exec-first additions. The structured inputs the visuals need are NOT stored
  // here (the SVGs are built at render time) — only the plain-text exec fields.
  bottomLine: string; // the one-sentence executive read; "" when national is null
  confidence: {
    level: string; // GOOD | PARTIAL | LOW
    line: string; // plain-English data-feed confidence
    feeds: { name: string; ok: boolean }[]; // raw OK/FAIL — appendix only
  };
```

- [ ] **Step 2: Add the failing test**

Append to `tests/sitrep.test.ts` (inside the existing top-level describe or a new one):

```typescript
import { dataConfidence } from "../src/lib/data-confidence";

describe("buildSitrepModel exec fields", () => {
  it("populates bottomLine and confidence", () => {
    const model = buildSitrepModel({
      national: {
        enso_phase: "el_nino_alert",
        alert_level: "RED",
        national_risk_rating: "high",
        affected_population_est: 1000,
        high_risk_province_count: 3,
        forecast_period: "Next 3 months",
        updated_at: "2026-06-20T00:00:00.000Z",
      },
      indicators: [],
      sectorRisk: [],
      lastRun: {
        started_at: "2026-06-20T00:00:00.000Z",
        finished_at: "2026-06-20T00:05:00.000Z",
        status: "partial",
        sources_ok: { a: true, b: true, c: false },
        notes: "",
      },
    });
    expect(model.bottomLine).toContain("national alert is RED");
    expect(model.confidence.level).toBe("PARTIAL");
    expect(model.confidence.feeds).toHaveLength(3);
  });

  it("leaves bottomLine empty when national is null", () => {
    const model = buildSitrepModel({ national: null, indicators: [], sectorRisk: [], lastRun: null });
    expect(model.bottomLine).toBe("");
    expect(model.confidence.level).toBe("LOW");
  });
});
```

(If `buildSitrepModel` is not already imported in `tests/sitrep.test.ts`, add it to the existing import from `"../src/lib/sitrep"`.)

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run tests/sitrep.test.ts`
Expected: FAIL — `model.bottomLine` / `model.confidence` undefined.

- [ ] **Step 4: Wire `buildSitrepModel`**

In `src/lib/sitrep.ts`:

Add imports near the top:

```typescript
import { bottomLineSentence } from "./national-language";
import { dataConfidence } from "./data-confidence";
```

In `buildSitrepModel`, after the `sources` line and before the `summary` line, add:

```typescript
  const bottomLine = national ? bottomLineSentence(national) : "";
  const confidence = dataConfidence(inputs.lastRun);
```

In the returned object, add `bottomLine` and `confidence` (place them right after `actions,`):

```typescript
    actions,
    bottomLine,
    confidence,
    strategic,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/sitrep.test.ts`
Expected: PASS — including the two new tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/sitrep.ts tests/sitrep.test.ts
git commit -m "feat: SITREP model carries exec bottom-line and data confidence"
git push && git status -sb && git rev-parse HEAD @{u}
```

---

### Task 11: Exec-first HTML renderer

Rebuild `renderSitrepHtml` to take the raw visual inputs, embed the four SVGs, lead exec-first, and move the feed dump into a Technical appendix.

**Files:**
- Modify: `src/lib/sitrep.ts`
- Modify: `tests/sitrep.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `tests/sitrep.test.ts`:

```typescript
import { renderSitrepHtml } from "../src/lib/sitrep";

describe("renderSitrepHtml exec-first government report", () => {
  const national = {
    enso_phase: "el_nino_alert" as const,
    alert_level: "RED" as const,
    national_risk_rating: "high" as const,
    affected_population_est: 1_795_581,
    high_risk_province_count: 3,
    forecast_period: "Next 3 months",
    updated_at: "2026-06-20T00:00:00.000Z",
  };
  const sectorRisk = [
    { province_code: "PG-EN", sector: "Food Security" as const, level: "critical" as const, score: 0.9, trend: "up" as const, provenance: "LIVE" as const, as_of: "2026-06-20" },
  ];
  const history = [
    { key: "ONI", value: 0.2, observed_at: "2026-01-01" },
    { key: "ONI", value: 0.9, observed_at: "2026-02-01" },
  ];
  const indicators = [
    { key: "ONI", label: "Oceanic Niño Index", unit: "", source: "NOAA", update_frequency: "monthly", provenance: "LIVE" as const, value: 0.9, observed_at: "2026-02-01", trend: "up" as const },
  ];
  const geojson = {
    type: "FeatureCollection" as const,
    features: [
      { type: "Feature" as const, properties: { code: "PG-EN", name: "Enga", is_focus: true, population: 432000 }, geometry: { type: "MultiPolygon" as const, coordinates: [[[[143, -5], [144, -5], [144, -6], [143, -5]]]] } },
    ],
  };

  it("leads exec-first, embeds the four visuals, and appendices the feed health", () => {
    const model = buildSitrepModel({ national, indicators, sectorRisk, lastRun: { started_at: "", finished_at: "", status: "partial", sources_ok: { noaa_oni: false, hdx_food: true }, notes: "" } });
    const html = renderSitrepHtml(model, { national, sectorRisk, history, geojson });

    // Visuals present.
    const svgCount = (html.match(/<svg /g) ?? []).length;
    expect(svgCount).toBeGreaterThanOrEqual(4);
    // Bottom line present.
    expect(html).toContain("national alert is RED");
    // Confidence line present, NOT the raw dump in the body.
    expect(html).toContain("data feeds reported this cycle");
    // Technical appendix heading present and holds the raw feed status.
    expect(html).toContain("Technical appendix");
    expect(html).toContain("noaa_oni");
    // Exec sections come before the appendix.
    expect(html.indexOf("Bottom line")).toBeLessThan(html.indexOf("Technical appendix"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/sitrep.test.ts`
Expected: FAIL — `renderSitrepHtml` takes one arg / no appendix.

- [ ] **Step 3: Rewrite `renderSitrepHtml`**

In `src/lib/sitrep.ts`:

Add imports near the top:

```typescript
import type { HistoricalReading, ProvinceFC } from "./types";
import {
  kpiBandSvg,
  riskMatrixSvg,
  trendChartSvg,
  provincialMapSvg,
} from "./sitrep-visuals";
```

Define the visuals input type above `renderSitrepHtml`. It carries `indicators` because the trend builder needs them (the trends pair each indicator's label with its history):

```typescript
export interface SitrepVisuals {
  national: NationalStatus | null;
  indicators: Indicator[];
  sectorRisk: SectorRisk[];
  history: HistoricalReading[];
  geojson: ProvinceFC;
}
```

(`Indicator` is already imported in `sitrep.ts`; add `HistoricalReading, ProvinceFC` per the import line above.)

Change the signature to `export function renderSitrepHtml(m: SitrepModel, v: SitrepVisuals): string {` and, inside, build the four SVGs at the top of the function:

```typescript
  const kpiSvg = kpiBandSvg(v.national);
  const matrixSvg = riskMatrixSvg(v.sectorRisk);
  const trendsSvg = trendChartSvg(v.history, v.indicators);
  const mapSvg = provincialMapSvg(v.geojson, v.sectorRisk);
```

Build the appendix and confidence badge HTML (replace the old `<footer>` block). Add this just before the final return template assembly:

```typescript
  const confBadgeColor =
    m.confidence.level === "GOOD" ? "#166534" : m.confidence.level === "PARTIAL" ? "#92400e" : "#991b1b";
  const confBadgeBg =
    m.confidence.level === "GOOD" ? "#dcfce7" : m.confidence.level === "PARTIAL" ? "#fef3c7" : "#fee2e2";

  const appendixFeedRows = m.confidence.feeds.length
    ? m.confidence.feeds
        .map((f) => `<tr><td>${esc(f.name)}</td><td><b>${f.ok ? "OK" : "FAIL"}</b></td></tr>`)
        .join("")
    : '<tr><td colspan="2">No ingest run reported this cycle.</td></tr>';
```

Now rewrite the returned HTML body. Replace the existing `<body>…</body>` content with the exec-first order. The full new body (keep the existing `<style>` block, ADD the rules below to it):

Add to the `<style>` block:

```css
    .badge { display:inline-block; padding:3px 10px; border-radius:4px; font-weight:600; font-size:12px; }
    figure { margin: 12px 0; }
    figure svg { max-width: 100%; height: auto; }
    .bottomline { border:1px solid #e4e4e7; border-left:4px solid #f43f5e; border-radius:6px; padding:10px 14px; background:#fafafa; margin-top:8px; }
    .appendix { margin-top:36px; border-top:2px solid #d4d4d8; padding-top:10px; }
    .appendix h2 { border:0; }
    .appendix table { max-width:360px; }
    .muted { color:#71717a; font-size:11px; }
```

New `<body>`:

```html
<body>
  <h1>NEWCIS · Weekly ENSO Situation Report</h1>
  <div>Period: <b>${m.period}</b> · Generated <b>${m.generatedAt}</b></div>
  <div style="margin-top:8px">
    <span class="badge" style="background:${confBadgeBg};color:${confBadgeColor}">Data confidence: ${m.confidence.level}</span>
    &nbsp; <span class="muted">${esc(m.confidence.line)}</span>
  </div>

  <section>
    <h2>Executive overview</h2>
    <figure>${kpiSvg}</figure>
  </section>

  <section>
    <h2>Bottom line</h2>
    <div class="bottomline">${m.bottomLine ? esc(m.bottomLine) : "No national status this cycle."}</div>
  </section>

  <section>
    <h2>Summary</h2>
    <p>${esc(m.summary)}</p>
  </section>

  <section>
    <h2>National risk matrix</h2>
    <figure>${matrixSvg}</figure>
  </section>

  <section>
    <h2>Provincial risk map</h2>
    <figure>${mapSvg}</figure>
  </section>

  <section>
    <h2>Provincial risk</h2>
    <p style="margin:4px 0 0;color:#52525b;font-size:12px">${esc(provincialRiskCaption(m.provinceCount, m.provincesAtRisk))}</p>
    <table>
      <thead><tr><th style="text-align:right">#</th><th>Province</th><th>Worst level</th><th>Worst sector</th><th style="text-align:right">Stressed</th></tr></thead>
      <tbody>${provinceTableRows}</tbody>
    </table>
  </section>

  <section>
    <h2>Indicator trends</h2>
    <figure>${trendsSvg}</figure>
    <table>
      <thead><tr><th>Key</th><th>Label</th><th style="text-align:right">Value</th><th>Unit</th><th>Source</th><th>Observed</th></tr></thead>
      <tbody>${indicatorRows || '<tr><td colspan="6">No indicators available.</td></tr>'}</tbody>
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

  ${strategicSection}

  ${analystSection}

  <section class="appendix">
    <h2>Technical appendix</h2>
    <p class="muted">For data and operations staff. ${esc(m.confidence.line)}</p>
    <table>
      <thead><tr><th>Data feed</th><th>Status this cycle</th></tr></thead>
      <tbody>${appendixFeedRows}</tbody>
    </table>
    <p class="muted">NEWCIS proof-of-concept · newcis.in4metrix.dev · Generated from a point-in-time data snapshot. Figures marked DEMO are seeded references, not live feeds.</p>
  </section>
</body>
```

(Remove the old `<footer>…</footer>` and the now-unused `sourceRow` const if it triggers a lint no-unused error — delete the `const sourceRow = …` line.)

- [ ] **Step 4: Update `generateSitrep` to pass visuals**

`generateSitrep` builds the model then renders HTML. It must pass the visuals. Change it to thread the raw inputs:

```typescript
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
```

This requires `SitrepInputs` to gain `history?` and `geojson?` — add to the interface:

```typescript
  /** 12-month indicator history, for the trend small-multiples. */
  history?: HistoricalReading[];
  /** Province geometry (public/provinces.geojson), for the provincial map. */
  geojson?: ProvinceFC;
```

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `pnpm vitest run tests/sitrep.test.ts && npx tsc --noEmit && pnpm lint`
Expected: PASS — new exec-first test green, existing sitrep tests still green.

- [ ] **Step 6: Check the file-size budget for `sitrep.ts`**

Run: `wc -l src/lib/sitrep.ts`
Expected: report the count. If over 500, extract the HTML body assembly into `src/lib/sitrep-html.ts` exporting `renderSitrepHtml(m, v)` and re-export it from `sitrep.ts`; move `esc`, `SitrepVisuals`, and the section-builder consts with it. Keep `buildSitrepModel`/`generateSitrep` in `sitrep.ts`. Re-run the suite after extraction.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sitrep.ts tests/sitrep.test.ts
git commit -m "feat: exec-first government SITREP HTML with visuals and technical appendix"
git push && git status -sb && git rev-parse HEAD @{u}
```

---

### Task 12: Exec-first docx renderer with PNG visuals

**Files:**
- Modify: `src/lib/sitrep-docx.ts`
- Test: `tests/sitrep-docx.test.ts`

- [ ] **Step 1: Write the failing smoke test**

```typescript
// tests/sitrep-docx.test.ts
import { describe, it, expect } from "vitest";
import { buildSitrepDocx } from "../src/lib/sitrep-docx";
import { buildSitrepModel } from "../src/lib/sitrep";

describe("buildSitrepDocx", () => {
  it("resolves to a non-empty .docx buffer with visuals embedded", async () => {
    const model = buildSitrepModel({
      national: {
        enso_phase: "el_nino_alert",
        alert_level: "RED",
        national_risk_rating: "high",
        affected_population_est: 1_795_581,
        high_risk_province_count: 3,
        forecast_period: "Next 3 months",
        updated_at: "2026-06-20T00:00:00.000Z",
      },
      indicators: [
        { key: "ONI", label: "Oceanic Niño Index", unit: "", source: "NOAA", update_frequency: "monthly", provenance: "LIVE", value: 0.9, observed_at: "2026-02-01", trend: "up" },
      ],
      sectorRisk: [
        { province_code: "PG-EN", sector: "Food Security", level: "critical", score: 0.9, trend: "up", provenance: "LIVE", as_of: "2026-06-20" },
      ],
      lastRun: { started_at: "", finished_at: "", status: "partial", sources_ok: { noaa_oni: false, hdx_food: true }, notes: "" },
    });

    const buffer = await buildSitrepDocx(model, {
      national: {
        enso_phase: "el_nino_alert", alert_level: "RED", national_risk_rating: "high",
        affected_population_est: 1_795_581, high_risk_province_count: 3,
        forecast_period: "Next 3 months", updated_at: "2026-06-20T00:00:00.000Z",
      },
      indicators: [
        { key: "ONI", label: "Oceanic Niño Index", unit: "", source: "NOAA", update_frequency: "monthly", provenance: "LIVE", value: 0.9, observed_at: "2026-02-01", trend: "up" },
      ],
      sectorRisk: [
        { province_code: "PG-EN", sector: "Food Security", level: "critical", score: 0.9, trend: "up", provenance: "LIVE", as_of: "2026-06-20" },
      ],
      history: [
        { key: "ONI", value: 0.2, observed_at: "2026-01-01" },
        { key: "ONI", value: 0.9, observed_at: "2026-02-01" },
      ],
      geojson: { type: "FeatureCollection", features: [] },
    });

    expect(buffer.length).toBeGreaterThan(2000);
    // .docx is a zip — starts with PK.
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/sitrep-docx.test.ts`
Expected: FAIL — `buildSitrepDocx` takes one argument.

- [ ] **Step 3: Wire visuals into `buildSitrepDocx`**

In `src/lib/sitrep-docx.ts`:

Add imports:

```typescript
import { ImageRun } from "docx";
import type { SitrepVisuals } from "./sitrep";
import { kpiBandSvg, riskMatrixSvg, trendChartSvg, provincialMapSvg } from "./sitrep-visuals";
import { svgToPng } from "./sitrep-raster";
```

(Extend the existing `import { … } from "docx";` to include `ImageRun` rather than adding a duplicate import.)

Add a helper near the top:

```typescript
// Rasterize one SVG and wrap it as a full-width Word image. width/height are the
// on-page points; the PNG is rendered at 2× for print crispness.
async function svgFigure(svg: string, ptW: number, ptH: number): Promise<Paragraph> {
  const png = await svgToPng(svg, ptW * 2);
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [
      new ImageRun({
        data: png,
        transformation: { width: ptW, height: ptH },
        type: "png",
      }),
    ],
  });
}
```

Change the signature to `export async function buildSitrepDocx(m: SitrepModel, v: SitrepVisuals): Promise<Buffer> {`.

Reorder the `children` assembly to exec-first and insert the figures. After the existing title block paragraphs, REPLACE the order so it reads: title → confidence line → KPI figure → Bottom line → Summary → Matrix figure → Map figure → Provincial table → Trends figure + indicators table → movers → actions → strategic → analyst note → Technical appendix.

Concretely, build the figures first (they're async):

```typescript
  const kpiFig = await svgFigure(kpiBandSvg(v.national), 600, 130);
  const matrixFig = await svgFigure(riskMatrixSvg(v.sectorRisk), 600, 280);
  const mapFig = await svgFigure(provincialMapSvg(v.geojson, v.sectorRisk), 470, 380);
  const trendsFig = await svgFigure(trendChartSvg(v.history, v.indicators), 600, 200);
```

Add the confidence line paragraph after the title block:

```typescript
  children.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: `Data confidence: ${m.confidence.level}. `, bold: true, size: 18 }),
        new TextRun({ text: m.confidence.line, size: 18, color: "52525B" }),
      ],
    }),
  );
```

Insert `children.push(sectionHeading("Executive overview"), kpiFig);` then the Bottom line:

```typescript
  children.push(
    sectionHeading("Bottom line"),
    new Paragraph({ children: [new TextRun({ text: m.bottomLine || "No national status this cycle.", size: 20 })] }),
  );
```

Keep the existing Summary section. After Summary, push `sectionHeading("National risk matrix"), matrixFig` and `sectionHeading("Provincial risk map"), mapFig` BEFORE the existing provincial-risk table section. Before the existing "Key indicators" table, push `sectionHeading("Indicator trends"), trendsFig`.

Finally, REPLACE the existing footer paragraphs (the "Data sources this cycle: …" block) with a Technical appendix:

```typescript
  children.push(
    new Paragraph({
      spacing: { before: 320 },
      border: { top: BORDER },
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: "TECHNICAL APPENDIX", bold: true, size: 20 })],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: `For data and operations staff. ${m.confidence.line}`, size: 16, color: "71717A" })],
    }),
  );
  const feedHead = new TableRow({
    tableHeader: true,
    children: [headerCell("Data feed"), headerCell("Status this cycle")],
  });
  const feedRows = m.confidence.feeds.length
    ? m.confidence.feeds.map((f) => new TableRow({ children: [cell(f.name), cell(f.ok ? "OK" : "FAIL", { bold: true })] }))
    : [new TableRow({ children: [cell("No ingest run reported this cycle.")] })];
  children.push(fullWidthTable([feedHead, ...feedRows]));
  children.push(
    new Paragraph({
      spacing: { before: 80 },
      children: [
        new TextRun({
          text: "NEWCIS proof-of-concept · newcis.in4metrix.dev · Generated from a point-in-time data snapshot. Figures marked DEMO are seeded references, not live feeds.",
          size: 16,
          color: "71717A",
        }),
      ],
    }),
  );
```

(Delete the old `sourceLine` const and its footer paragraphs.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/sitrep-docx.test.ts`
Expected: PASS — non-empty PK-prefixed buffer.

- [ ] **Step 5: File-size budget check + typecheck + lint**

Run: `wc -l src/lib/sitrep-docx.ts && npx tsc --noEmit && pnpm lint`
Expected: under 500 (if over, extract `svgFigure` + the appendix builder to `src/lib/sitrep-docx-helpers.ts`). Typecheck + lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sitrep-docx.ts tests/sitrep-docx.test.ts
git commit -m "feat: exec-first SITREP .docx with PNG visuals and technical appendix"
git push && git status -sb && git rev-parse HEAD @{u}
```

---

### Task 13: Thread history + geojson through the three routes

The routes must now load `history` and `geojson` and pass them to the model/renderers.

**Files:**
- Modify: `src/app/api/sitrep/route.ts`
- Modify: `src/app/api/sitrep/docx/route.ts`
- Modify: `src/app/api/sitrep/[id]/docx/route.ts`

- [ ] **Step 1: `POST /api/sitrep/route.ts` — load history + geojson**

Add `getProvincesGeojson` and `getReadingsHistory` to the `@/lib/data` import. Add both to the `Promise.all` and pass them into `generateSitrep`:

```typescript
const [national, indicators, sectorRisk, lastRun, wefInsights, history, geojson] =
  await Promise.all([
    getNationalStatus(),
    getIndicators(),
    getSectorRisk(),
    getLastRun(),
    getWefInsights(),
    getReadingsHistory(),
    getProvincesGeojson(),
  ]);

const sitrep = generateSitrep({
  national,
  indicators,
  sectorRisk,
  lastRun,
  wefInsights,
  history,
  geojson,
  analystNote: body.analyst_note,
});
```

- [ ] **Step 2: `POST /api/sitrep/docx/route.ts` — build model + docx with visuals**

Add `getReadingsHistory`, `getProvincesGeojson` to imports; add to `Promise.all`. Build the model and pass visuals to `buildSitrepDocx`:

```typescript
const model = buildSitrepModel({
  national, indicators, sectorRisk, lastRun, wefInsights,
  history, geojson, analystNote: body.analyst_note,
});
const buffer = await buildSitrepDocx(model, { national, indicators, sectorRisk, history, geojson });
```

- [ ] **Step 3: `GET /api/sitrep/[id]/docx/route.ts` — visuals for stored + rebuilt**

This route prefers the stored `sitrep.model`. For visuals, re-read the cheap static inputs (`getReadingsHistory`, `getProvincesGeojson`) and the current `national`/`sectorRisk`/`indicators` for the rebuild path. Update both branches:

```typescript
const [history, geojson] = await Promise.all([
  getReadingsHistory(),
  getProvincesGeojson(),
]);

let model = sitrep.model;
let national: NationalStatus | null;
let indicators: Indicator[];
let sectorRisk: SectorRisk[];

if (!model) {
  const [nat, inds, sr, lastRun, wefInsights] = await Promise.all([
    getNationalStatus(), getIndicators(), getSectorRisk(), getLastRun(), getWefInsights(),
  ]);
  national = nat; indicators = inds; sectorRisk = sr;
  model = buildSitrepModel({ national, indicators, sectorRisk, lastRun, wefInsights, history, geojson, analystNote: sitrep.analyst_note });
} else {
  // Stored model path — re-read current national/sector/indicators for the
  // visuals (cheap static reads; the persisted point-in-time text stays from the model).
  const [nat, inds, sr] = await Promise.all([getNationalStatus(), getIndicators(), getSectorRisk()]);
  national = nat; indicators = inds; sectorRisk = sr;
}

const buffer = await buildSitrepDocx(model, { national, indicators, sectorRisk, history, geojson });
```

Add `NationalStatus, Indicator, SectorRisk` to the type import from `@/lib/types` in that file, and `getReadingsHistory, getProvincesGeojson, getIndicators` to the data import (it already imports several `get*`).

- [ ] **Step 4: Typecheck, lint, build**

Run: `npx tsc --noEmit && pnpm lint && pnpm build`
Expected: PASS — all three routes typecheck; production build succeeds (the SVG builders + resvg run server-side).

- [ ] **Step 5: Run the full test suite**

Run: `pnpm vitest run`
Expected: PASS — all suites green.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/sitrep/route.ts src/app/api/sitrep/docx/route.ts "src/app/api/sitrep/[id]/docx/route.ts"
git commit -m "feat: route SITREP history and geojson into the report visuals"
git push && git status -sb && git rev-parse HEAD @{u}
```

---

### Task 14: Visual verification in the browser

Confirm the actual rendered report — not just tests — looks government-grade.

**Files:** none (verification only)

- [ ] **Step 1: Start the dev preview**

Start the `newcis-dev` preview server (port 3000) via the Preview MCP (`preview_start "newcis-dev"`), or `pnpm dev` in a background shell.

- [ ] **Step 2: Generate a report and open the HTML**

Trigger the SITREP generator (Page 4 button) or `POST /api/sitrep`, then open the returned HTML in the preview. Confirm by screenshot:
- KPI band renders 6 cells, alert cell tinted by traffic-light.
- Bottom-line sentence reads in plain English.
- Risk matrix shows sectors × (National + focus provinces) with coloured cells + legend.
- Provincial map shows PNG provinces, focus provinces coloured by worst level.
- Indicator trends show mini line charts.
- "Technical appendix" sits at the very bottom with the OK/FAIL feed table — and the engineer dump is NOT in the body.

- [ ] **Step 3: Download the .docx and sanity-check**

`POST /api/sitrep/docx`, save the file, confirm the buffer is a valid .docx (opens; visuals present as images). If a headless check is needed: `unzip -l` the file and confirm `word/media/*.png` entries exist.

```bash
curl -s -X POST http://localhost:3000/api/sitrep/docx -o /tmp/sitrep.docx && unzip -l /tmp/sitrep.docx | grep -c "media/.*png"
```

Expected: 4 (KPI, matrix, map, trends PNGs embedded).

- [ ] **Step 4: No commit unless verification surfaced a fix**

If everything renders correctly, there's nothing to commit (verification only). If a tweak was needed, commit it:

```bash
git add -A && git commit -m "fix: SITREP visual polish from browser verification"
git push && git status -sb && git rev-parse HEAD @{u}
```

---

## Final review

After all tasks: dispatch a final code review over the whole change (all SITREP modules + routes), then use `superpowers:finishing-a-development-branch`.

Run the full gate once more:

```bash
pnpm vitest run && npx tsc --noEmit && pnpm lint && pnpm build
```

Expected: all green.
