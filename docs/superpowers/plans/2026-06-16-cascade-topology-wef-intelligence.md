# Cascade Topology + WEF Strategic Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a view-only sector→sector cascade layer (REFERENCE, no rescore) and a WEF Strategic Intelligence panel (DEMO, real public links) to the `/topology` page, delivering the WEF "neural map" inspiration honestly.

**Architecture:** Pure view-layer additions. A new `SECTOR_CASCADES` map (code) feeds new `kind:"cascade"` edges from `buildTopology`; `RiskTopology` renders them curved/dashed/distinct and lights the downstream chain on click. A new `data/wef_insights.json` (seeded, DEMO) renders below the graph via a new `WefStrategicIntelligence` component and surfaces in the node drill panel. The risk engine is untouched.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, framer-motion, vitest, Tailwind semantic tokens.

---

## File Structure

| File | Responsibility | Status |
|---|---|---|
| `src/lib/cascades.ts` | `SECTOR_CASCADES` curated map + `SectorCascade` type | Create |
| `data/wef_insights.json` | Seeded WEF insight tiles (DEMO) | Create |
| `src/lib/wef.ts` | `WefInsight` type + `getWefInsights()` reader | Create |
| `src/lib/topology.ts` | Emit `kind:"cascade"` edges from `SECTOR_CASCADES` | Modify |
| `src/components/WefStrategicIntelligence.tsx` | WEF panel (placement B) | Create |
| `src/components/RiskTopology.tsx` | Render cascade edges; WEF context in drill (C); accept `wefInsights` prop | Modify |
| `src/app/topology/page.tsx` | Fetch WEF insights, pass to components, mount WEF section | Modify |
| `tests/cascades.test.ts` | `SECTOR_CASCADES` integrity | Create |
| `tests/topology.test.ts` | cascade edge emission + no-rescore | Modify |
| `tests/wef.test.ts` | WEF insights shape/URL/provenance | Create |

Reference facts (verified against codebase):
- `Sector` union (exact, `src/lib/types.ts:9-17`): `"Food Security" | "Water Security" | "Public Health" | "Economic Stability" | "Infrastructure" | "Energy Security" | "Social Stability" | "Disaster & Hazard"`.
- `Provenance` = `"LIVE" | "DEMO" | "REFERENCE"` (`src/lib/types.ts:4`).
- Data reader pattern: `readJson<T>(file, fallback)` in `src/lib/data.ts:37`; getters like `export const getSectorRisk = () => readJson<SectorRisk[]>("sector_risk.json", []);`.
- `TopoEdge.kind` currently `"driver" | "rollup" | "attributed"` (`src/lib/topology.ts:63`).
- Test runner: `pnpm vitest run`. Build: `pnpm build`.
- Standing rule: after each green commit, **push** so local == remote.

---

## Task 1: SectorCascade type + SECTOR_CASCADES map

**Files:**
- Create: `src/lib/cascades.ts`
- Test: `tests/cascades.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/cascades.test.ts
import { describe, expect, it } from "vitest";
import { SECTOR_CASCADES } from "../src/lib/cascades";
import type { Sector } from "../src/lib/types";

const SECTORS: Sector[] = [
  "Food Security", "Water Security", "Public Health", "Economic Stability",
  "Infrastructure", "Energy Security", "Social Stability", "Disaster & Hazard",
];

describe("SECTOR_CASCADES", () => {
  it("has at least 5 cascade edges", () => {
    expect(SECTOR_CASCADES.length).toBeGreaterThanOrEqual(5);
  });

  it("uses only valid Sector endpoints", () => {
    for (const c of SECTOR_CASCADES) {
      expect(SECTORS).toContain(c.from);
      expect(SECTORS).toContain(c.to);
    }
  });

  it("has no self-loops", () => {
    for (const c of SECTOR_CASCADES) expect(c.from).not.toBe(c.to);
  });

  it("has no duplicate edges", () => {
    const seen = new Set(SECTOR_CASCADES.map((c) => `${c.from}->${c.to}`));
    expect(seen.size).toBe(SECTOR_CASCADES.length);
  });

  it("every edge carries a non-empty rationale and a valid strength", () => {
    for (const c of SECTOR_CASCADES) {
      expect(c.rationale.trim().length).toBeGreaterThan(0);
      expect(["weak", "moderate", "strong"]).toContain(c.strength);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/cascades.test.ts`
Expected: FAIL — cannot find module `../src/lib/cascades`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/cascades.ts
/**
 * SECTOR_CASCADES — curated sector→sector causal links (the WEF "neural map"
 * payoff). These are TRUE real-world dependencies (e.g. water scarcity raises
 * disease risk), drawn so the topology shows how risks drive EACH OTHER — not
 * just indicator→sector. They are a VIEW-ONLY overlay badged REFERENCE: they
 * show the relationship, they do NOT re-score any sector. `strength` is reserved
 * for a future engine-wired amplifier (see the design doc, §7) and is unused by
 * the current view.
 */
import type { Sector } from "./types";

export interface SectorCascade {
  from: Sector;
  to: Sector;
  rationale: string;
  strength: "weak" | "moderate" | "strong";
}

export const SECTOR_CASCADES: SectorCascade[] = [
  {
    from: "Water Security",
    to: "Public Health",
    strength: "strong",
    rationale: "Water scarcity and contamination raise waterborne-disease risk.",
  },
  {
    from: "Food Security",
    to: "Social Stability",
    strength: "strong",
    rationale: "Food shortages and price spikes drive unrest and displacement.",
  },
  {
    from: "Disaster & Hazard",
    to: "Infrastructure",
    strength: "moderate",
    rationale: "Seismic and flood events damage roads, power, and water systems.",
  },
  {
    from: "Economic Stability",
    to: "Food Security",
    strength: "moderate",
    rationale: "Economic shock erodes import capacity and household purchasing power.",
  },
  {
    from: "Infrastructure",
    to: "Energy Security",
    strength: "moderate",
    rationale: "Damaged transport and grid disrupt fuel and power delivery.",
  },
  {
    from: "Public Health",
    to: "Social Stability",
    strength: "weak",
    rationale: "Health-system strain compounds social pressure.",
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/cascades.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit + push**

```bash
git add src/lib/cascades.ts tests/cascades.test.ts
git commit -m "feat(topology): add SECTOR_CASCADES causal map (REFERENCE)"
git push
```

---

## Task 2: Emit cascade edges from buildTopology

**Files:**
- Modify: `src/lib/topology.ts` (the `TopoEdge.kind` union ~line 63; the sector loop ~lines 201-226; add cascade emission after the attributed-drivers loop ~line 240)
- Test: `tests/topology.test.ts` (append a new `describe`)

- [ ] **Step 1: Write the failing tests**

Append to `tests/topology.test.ts` (the `indicator`, `sectorRow`, `FOCUS`, `TH` helpers already exist at the top of that file — reuse them):

```ts
describe("buildTopology — sector cascades (REFERENCE overlay)", () => {
  const indicators = [indicator("ONI", 1.2), indicator("RAINFALL_ANOM", -50)];
  const sectorRisks = [
    sectorRow("PG08", "Water Security", "critical"),
    sectorRow("PG08", "Public Health", "med"),
    sectorRow("PG08", "Food Security", "high"),
    sectorRow("PG08", "Social Stability", "low"),
  ];
  const g = buildTopology({
    indicators, sectorRisks, thresholds: TH, focusCodes: FOCUS,
    center: { kind: "national" },
  });

  it("emits a cascade edge between two sector nodes (Water → Public Health)", () => {
    const e = g.edges.find(
      (x) => x.from === "Water Security" && x.to === "Public Health",
    );
    expect(e?.kind).toBe("cascade");
  });

  it("cascade edge level tracks the DOWNSTREAM sector", () => {
    // Public Health is 'med' here → the Water→Public Health cascade reads 'med'
    const e = g.edges.find(
      (x) => x.from === "Water Security" && x.to === "Public Health",
    )!;
    expect(e.level).toBe("med");
  });

  it("does NOT rescore: sector node levels are unchanged by cascades", () => {
    // Public Health stays 'med' (its own row), NOT raised by the critical Water cascade
    const ph = g.nodes.find((n) => n.kind === "sector" && n.id === "Public Health")!;
    expect(ph.level).toBe("med");
  });

  it("all sectors always present, so every defined cascade is emitted", () => {
    // ALL_SECTORS guarantees both endpoints exist as nodes → 6 SECTOR_CASCADES edges
    const cascades = g.edges.filter((x) => x.kind === "cascade");
    expect(cascades.length).toBe(6);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/topology.test.ts`
Expected: FAIL — no edge with `kind === "cascade"` exists yet.

- [ ] **Step 3: Add the import + widen the edge kind union**

In `src/lib/topology.ts`, add to the top imports (after the `risk-engine` import line 18):

```ts
import { SECTOR_CASCADES } from "./cascades";
```

Change the `TopoEdge.kind` union (currently line ~63) from:

```ts
  kind: "driver" | "rollup" | "attributed";
```

to:

```ts
  kind: "driver" | "rollup" | "attributed" | "cascade";
```

Add a doc line inside the `TopoEdge` jsdoc block (after the `"attributed"` bullet, before the closing `*/`):

```ts
   *  - "cascade"    — sector → sector causal link (from SECTOR_CASCADES). A
   *                   view-only REFERENCE overlay: it shows that one sector
   *                   drives another, it does NOT re-score the downstream sector.
```

- [ ] **Step 4: Emit cascade edges**

In `src/lib/topology.ts`, immediately BEFORE the final `return { nodes, edges, center };` (line ~242), insert:

```ts
  // ----- sector → sector cascades (REFERENCE overlay) -----
  // The WEF "neural map" payoff: how sector risks drive EACH OTHER. These are
  // curated causal links, not engine output — drawn so the picture shows the
  // cascade web. View-only: the downstream sector's node level is UNCHANGED; the
  // edge merely carries that level so a cascade into a hot sector reads hot.
  const sectorLevel = new Map<Sector, RiskLevel>();
  for (const n of nodes) {
    if (n.kind === "sector") sectorLevel.set(n.id as Sector, n.level as RiskLevel);
  }
  for (const c of SECTOR_CASCADES) {
    // Both endpoints are always present (ALL_SECTORS emits every sector node),
    // but guard anyway so the builder degrades rather than throws.
    if (!sectorLevel.has(c.from) || !sectorLevel.has(c.to)) continue;
    edges.push({
      from: c.from,
      to: c.to,
      level: sectorLevel.get(c.to)!, // downstream level → edge weight/colour
      kind: "cascade",
    });
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/topology.test.ts`
Expected: PASS — including the existing topology tests (no regression).

- [ ] **Step 6: Run the full suite**

Run: `pnpm vitest run`
Expected: PASS (all prior tests + new cascade tests).

- [ ] **Step 7: Commit + push**

```bash
git add src/lib/topology.ts tests/topology.test.ts
git commit -m "feat(topology): emit sector cascade edges (view-only, no rescore)"
git push
```

---

## Task 3: WefInsight type + reader + seed data

**Files:**
- Create: `src/lib/wef.ts`
- Create: `data/wef_insights.json`
- Test: `tests/wef.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/wef.test.ts
import { describe, expect, it } from "vitest";
import insights from "../data/wef_insights.json";
import type { WefInsight } from "../src/lib/wef";

const ITEMS = insights as WefInsight[];

describe("wef_insights.json", () => {
  it("has at least 5 insight tiles", () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(5);
  });

  it("every tile is DEMO provenance (honest: not LIVE without an API)", () => {
    for (const it of ITEMS) expect(it.provenance).toBe("DEMO");
  });

  it("every url is an https weforum.org link", () => {
    for (const it of ITEMS) {
      expect(it.url).toMatch(/^https:\/\/www\.weforum\.org\//);
    }
  });

  it("every tile has id, title, summary, source, published", () => {
    for (const it of ITEMS) {
      expect(it.id.length).toBeGreaterThan(0);
      expect(it.title.length).toBeGreaterThan(0);
      expect(it.summary.length).toBeGreaterThan(0);
      expect(it.source.length).toBeGreaterThan(0);
      expect(it.published.length).toBeGreaterThan(0);
    }
  });

  it("ids are unique", () => {
    const ids = new Set(ITEMS.map((i) => i.id));
    expect(ids.size).toBe(ITEMS.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/wef.test.ts`
Expected: FAIL — cannot find `../src/lib/wef` and `../data/wef_insights.json`.

- [ ] **Step 3: Write the type + reader**

```ts
// src/lib/wef.ts
/**
 * WEF Strategic Intelligence insights. Seeded from WEF's OPENLY published,
 * citable outputs (Global Risks Report, public Forum Stories) and linked back to
 * their real public pages. Badged DEMO — honest: we do not have a WEF API or an
 * embedding licence, and we never lift login-gated/paywalled content. A later
 * official WEF API swaps these for LIVE rows without a render change.
 *
 * `summary` is a PARAPHRASE, not WEF body text (copyright). `sector` ties a tile
 * to a NEWCIS sector for the node drill panel; omit it for national-level tiles.
 */
import type { Provenance, Sector } from "./types";
import { readJson } from "./data";

export interface WefInsight {
  id: string;
  title: string;
  summary: string;
  url: string;
  sector?: Sector;
  source: string;
  published: string;
  provenance: Provenance;
}

export const getWefInsights = () =>
  readJson<WefInsight[]>("wef_insights.json", []);
```

NOTE: `readJson` is currently declared `async function readJson<T>` and NOT exported (`src/lib/data.ts:37`). Export it: change line 37 from `async function readJson<T>(` to `export async function readJson<T>(`. (It reads from the `/data` dir, which is what we want — `wef_insights.json` lives in `/data` alongside the other JSON.)

- [ ] **Step 4: Write the seed data**

```json
// data/wef_insights.json
[
  {
    "id": "wef-el-nino-systemic-shock-2026",
    "title": "The coming El Niño is more than a climate event — it is a systemic shock",
    "summary": "WEF frames the next El Niño as a cross-sector systemic shock spanning food, water, health, and economic stability — not a standalone weather event.",
    "url": "https://www.weforum.org/stories/2026/06/the-coming-el-nino-is-more-than-a-climate-event-it-is-a-systemic-shock/",
    "source": "WEF Agenda",
    "published": "2026-06",
    "provenance": "DEMO"
  },
  {
    "id": "wef-el-nino-food-production",
    "title": "El Niño weather patterns could impact global food production",
    "summary": "WEF notes El Niño-driven drought hits food production, naming Papua New Guinea highlands droughts as a recurring food- and water-insecurity driver.",
    "url": "https://www.weforum.org/stories/2023/06/el-nino-weather-impact-food-production/",
    "sector": "Food Security",
    "source": "WEF Agenda",
    "published": "2023-06",
    "provenance": "DEMO"
  },
  {
    "id": "wef-global-risks-2025-digest",
    "title": "Global Risks Report 2025",
    "summary": "Extreme weather ranks the top ten-year global risk for the second year running, with environmental risks dominating the long-term outlook.",
    "url": "https://www.weforum.org/publications/global-risks-report-2025/digest/",
    "source": "WEF Global Risks Report 2025",
    "published": "2025-01",
    "provenance": "DEMO"
  },
  {
    "id": "wef-global-risks-2025-top-threats",
    "title": "Global Risks Report 2025: conflict, environment and disinformation top threats",
    "summary": "WEF's expert survey ranks environmental and societal risks among the most severe near- and long-term global threats.",
    "url": "https://www.weforum.org/press/2025/01/global-risks-report-2025-conflict-environment-and-disinformation-top-threats/",
    "sector": "Social Stability",
    "source": "WEF Global Risks Report 2025",
    "published": "2025-01",
    "provenance": "DEMO"
  },
  {
    "id": "wef-securing-water",
    "title": "Securing water through the power of multi-stakeholder action",
    "summary": "WEF positions water security as a shared risk requiring coordinated multi-stakeholder action as climate pressure intensifies.",
    "url": "https://www.weforum.org/stories/2025/02/securing-water-through-the-power-of-multi-stakeholder-action/",
    "sector": "Water Security",
    "source": "WEF Agenda",
    "published": "2025-02",
    "provenance": "DEMO"
  },
  {
    "id": "wef-food-security-polycrisis",
    "title": "How to maintain global food security during a 'polycrisis'",
    "summary": "WEF examines food security under overlapping climate, economic, and conflict shocks — a polycrisis straining import-dependent economies.",
    "url": "https://www.weforum.org/stories/2023/06/global-food-security-during-a-polycrisis/",
    "sector": "Economic Stability",
    "source": "WEF Agenda",
    "published": "2023-06",
    "provenance": "DEMO"
  },
  {
    "id": "wef-asia-pacific-sdgs",
    "title": "Why Asia-Pacific must accelerate action on meeting SDGs",
    "summary": "WEF urges accelerated Asia-Pacific action on climate, poverty, and hunger to keep Sustainable Development Goals within reach.",
    "url": "https://www.weforum.org/stories/2024/08/asia-pacific-sdgs-climate-poverty-hunger-action/",
    "source": "WEF Agenda",
    "published": "2024-08",
    "provenance": "DEMO"
  }
]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/wef.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit + push**

```bash
git add src/lib/wef.ts data/wef_insights.json src/lib/data.ts tests/wef.test.ts
git commit -m "feat(wef): seed WEF Strategic Intelligence insights (DEMO, public links)"
git push
```

---

## Task 4: WefStrategicIntelligence component (placement B)

**Files:**
- Create: `src/components/WefStrategicIntelligence.tsx`

(No unit test — presentational component; covered by build + the data test in Task 3. Verified by build in Step 3.)

- [ ] **Step 1: Write the component**

```tsx
// src/components/WefStrategicIntelligence.tsx
/**
 * WEF Strategic Intelligence — placement B: a standing section below the topology
 * graph. Tiles are seeded from WEF's openly published outputs (DEMO), each
 * linking out to a real public WEF page. This brings genuine WEF risk framing
 * onto NEWCIS without scraping login-gated content or copying WEF body text.
 */
import { ExternalLink } from "lucide-react";
import type { WefInsight } from "@/lib/wef";
import { Card, SectionHeader, Badge } from "./ui";

export function WefStrategicIntelligence({ insights }: { insights: WefInsight[] }) {
  if (insights.length === 0) return null;
  const [headline, ...rest] = insights;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SectionHeader
          title="WEF Strategic Intelligence"
          description="World Economic Forum risk framing, mapped to NEWCIS sectors."
        />
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <Badge>DEMO</Badge>
          <span>Source: World Economic Forum</span>
        </div>
      </div>

      {/* headline tile spans wide */}
      <a
        href={headline.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block group"
      >
        <Card className="space-y-2 transition-colors hover:border-border-strong">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-text-muted">
            <span>{headline.source}</span>
            <span data-numeric>{headline.published}</span>
          </div>
          <h3 className="text-base font-semibold group-hover:text-accent transition-colors">
            {headline.title}
          </h3>
          <p className="text-sm text-text-muted leading-relaxed">{headline.summary}</p>
          <span className="inline-flex items-center gap-1 text-xs text-accent">
            Read on weforum.org <ExternalLink size={12} />
          </span>
        </Card>
      </a>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((i) => (
          <a
            key={i.id}
            href={i.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <Card className="h-full space-y-2 transition-colors hover:border-border-strong">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-text-muted">
                <span>{i.source}</span>
                <span data-numeric>{i.published}</span>
              </div>
              <h4 className="text-sm font-semibold group-hover:text-accent transition-colors">
                {i.title}
              </h4>
              <p className="text-xs text-text-muted leading-relaxed">{i.summary}</p>
              <span className="inline-flex items-center gap-1 text-[11px] text-accent">
                Read on weforum.org <ExternalLink size={11} />
              </span>
            </Card>
          </a>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify Badge accepts children**

Run: `grep -n "export function Badge" src/components/ui/Badge.tsx`
Then open the file and confirm `Badge` renders `children`. If `Badge` requires a specific prop instead of children, adjust the `<Badge>DEMO</Badge>` usage to match its real signature (e.g. `<Badge label="DEMO" />`). Do not invent a prop — match the actual component.

- [ ] **Step 3: Build to verify it compiles**

Run: `pnpm build`
Expected: SUCCESS (no type errors).

- [ ] **Step 4: Commit + push**

```bash
git add src/components/WefStrategicIntelligence.tsx
git commit -m "feat(wef): WEF Strategic Intelligence panel component"
git push
```

---

## Task 5: Render cascade edges + WEF drill in RiskTopology

**Files:**
- Modify: `src/components/RiskTopology.tsx` (Props ~line 38; legend ~lines 199-207; edge render ~lines 227-260; drill panel sector branch ~lines 364-369)

- [ ] **Step 1: Add `wefInsights` prop + import**

In `src/components/RiskTopology.tsx`, add to the type imports (line 18 area):

```ts
import type { WefInsight } from "@/lib/wef";
```

Add to the `Props` interface (after `provinces: ProvinceOpt[];`, line 43):

```ts
  /** WEF insights for the per-sector drill context (placement C). */
  wefInsights?: WefInsight[];
```

Add `wefInsights = []` to the destructured params in the function signature (after `provinces,`):

```ts
  wefInsights = [],
```

- [ ] **Step 2: Style cascade edges**

In the edge `.map` (around lines 246-254), replace the `const attributed = e.kind === "attributed";` line and the returned `<motion.path>` styling so cascade edges are visually distinct. Change the block to:

```ts
            const attributed = e.kind === "attributed";
            const cascade = e.kind === "cascade";
            // Cascade edges (sector→sector) bow harder and ride a distinct dash so
            // the "risks drive each other" web reads separately from the radial
            // driver/rollup spokes. They are REFERENCE, never a rescore.
            const bow = cascade ? 0.42 : 0.18;
            const mx2 = (a.x + b.x) / 2 + (CX - (a.x + b.x) / 2) * bow;
            const my2 = (a.y + b.y) / 2 + (CY - (a.y + b.y) / 2) * bow;
            return (
              <motion.path
                key={`${e.from}->${e.to}-${i}`}
                d={`M ${a.x} ${a.y} Q ${mx2} ${my2} ${b.x} ${b.y}`}
                fill="none"
                stroke={colour}
                strokeWidth={related && selected ? 2.5 : cascade ? 2 : attributed ? 1.75 : 1.5}
                strokeDasharray={cascade ? "2 5" : attributed ? "5 4" : undefined}
                strokeLinecap={cascade ? "round" : undefined}
                initial={{ opacity: 0 }}
                animate={{ opacity: dim }}
                transition={{ duration: reduce ? 0 : 0.4, delay: t(i) }}
              />
            );
```

(This replaces the existing `mx`/`my`/`attributed`/return block. Remove the now-unused `const mx =` and `const my =` lines at ~241-242 to avoid an unused-variable lint error.)

- [ ] **Step 3: Add the legend entry**

In the legend row (after the `province-attributed` span, ~line 206), add:

```tsx
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-dotted border-text-1" />
            risk cascade <span className="font-semibold">(REFERENCE)</span>
          </span>
```

- [ ] **Step 4: Build a sector→insight lookup + show WEF context in the drill**

After `const selectedNode = selected ? byId.get(selected) : undefined;` (line ~94), add:

```ts
  const wefBySector = useMemo(() => {
    const m = new Map<string, WefInsight>();
    for (const w of wefInsights) {
      if (w.sector && !m.has(w.sector)) m.set(w.sector, w);
    }
    return m;
  }, [wefInsights]);
  const selectedWef =
    selectedNode?.kind === "sector" ? wefBySector.get(selectedNode.id) : undefined;
```

Then in the drill panel, inside the `selectedNode.kind === "sector"` branch (replace the existing single `<p>` at lines 364-369 with the `<p>` PLUS the WEF block):

```tsx
            {selectedNode.kind === "sector" && (
              <>
                <p className="text-xs text-text-muted leading-relaxed">
                  Worst risk across the centre&apos;s scope. Trace the lit edges back to
                  the indicators driving it, and the dotted cascades to the sectors it
                  pressures — that is the &quot;why&quot;.
                </p>
                {selectedWef && (
                  <a
                    href={selectedWef.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-md border border-border-default p-2.5 hover:border-border-strong transition-colors group"
                  >
                    <div className="text-[10px] uppercase tracking-[0.1em] text-text-muted mb-1">
                      WEF context
                    </div>
                    <div className="text-xs font-medium group-hover:text-accent transition-colors">
                      {selectedWef.title}
                    </div>
                  </a>
                )}
              </>
            )}
```

- [ ] **Step 5: Build to verify it compiles**

Run: `pnpm build`
Expected: SUCCESS (no type/lint errors; confirm no unused `mx`/`my`).

- [ ] **Step 6: Run full suite (no regression)**

Run: `pnpm vitest run`
Expected: PASS (all tests).

- [ ] **Step 7: Commit + push**

```bash
git add src/components/RiskTopology.tsx
git commit -m "feat(topology): render cascade edges + WEF drill context"
git push
```

---

## Task 6: Wire WEF into the topology page

**Files:**
- Modify: `src/app/topology/page.tsx` (data imports ~lines 10-16; `Promise.all` ~lines 21-27; `<RiskTopology>` props ~lines 59-65; add `<WefStrategicIntelligence>` below the graph div ~line 67)

- [ ] **Step 1: Add imports**

In `src/app/topology/page.tsx`, add component + data imports:

```ts
import { WefStrategicIntelligence } from "@/components/WefStrategicIntelligence";
import { getWefInsights } from "@/lib/wef";
```

(Place the component import near the other `@/components/*` imports; the `getWefInsights` import can go right after the `@/lib/data` import block.)

- [ ] **Step 2: Fetch WEF insights**

Change the `Promise.all` destructure (lines ~21-27) to add `wefInsights`:

```ts
  const [national, indicators, sectorRisks, thresholds, lastRun, wefInsights] =
    await Promise.all([
      getNationalStatus(),
      getIndicators(),
      getSectorRisk(),
      getRiskThresholds(),
      getLastRun(),
      getWefInsights(),
    ]);
```

- [ ] **Step 3: Pass to RiskTopology + mount the WEF section**

Add `wefInsights={wefInsights}` to the `<RiskTopology ... />` props (after `provinces={provinces}`):

```tsx
            wefInsights={wefInsights}
```

Then, immediately AFTER the closing `</div>` of the `px-4 md:px-6 py-6` graph wrapper (line ~67) and BEFORE `<DashboardFooter ... />`, insert:

```tsx
      <div className="px-4 md:px-6 pb-8">
        <WefStrategicIntelligence insights={wefInsights} />
      </div>
```

- [ ] **Step 4: Build to verify it compiles**

Run: `pnpm build`
Expected: SUCCESS.

- [ ] **Step 5: Visual smoke check**

Run the dev server (or the existing preview) and open `/topology`. Confirm:
- Dotted REFERENCE cascade edges arc between sector nodes; legend shows "risk cascade (REFERENCE)".
- Clicking a sector node with a WEF match (e.g. Food Security, Water Security) shows a "WEF context" block linking to weforum.org.
- The "WEF Strategic Intelligence" section renders below the graph with the 2026 El Niño headline tile + grid; links open weforum.org in a new tab.
- No DEMO tile claims LIVE; no console errors.

- [ ] **Step 6: Commit + push**

```bash
git add src/app/topology/page.tsx
git commit -m "feat(topology): mount WEF Strategic Intelligence on the topology page"
git push
```

---

## Task 7: Final verification + sync

- [ ] **Step 1: Full test suite**

Run: `pnpm vitest run`
Expected: PASS (all suites: cascades, wef, topology + prior).

- [ ] **Step 2: Production build**

Run: `pnpm build`
Expected: SUCCESS.

- [ ] **Step 3: Confirm local == remote**

Run: `git status --short && git rev-parse HEAD && git rev-parse @{u}`
Expected: clean tree; both hashes identical.

- [ ] **Step 4: Confirm honesty contract**

Manually verify:
- Risk engine files (`src/lib/risk-engine.ts`) untouched — `git log --oneline -- src/lib/risk-engine.ts` shows no new commit from this feature.
- Cascade edges badged REFERENCE in legend; WEF tiles badged DEMO.
- No WEF body text copied verbatim (summaries are paraphrases).

---

## Self-Review

**Spec coverage:**
- §5 cascade layer (data + render + honesty) → Tasks 1, 2, 5. ✓
- §6 WEF panel (data, render B, drill C, honesty, upgrade path) → Tasks 3, 4, 5, 6. ✓
- §3 non-goals (no engine change, no scraping, no live API) → enforced; Task 7 Step 4 verifies engine untouched. ✓
- §8 testing (cascades integrity, topology cascade emission + no-rescore, WEF shape) → Tasks 1, 2, 3. ✓
- §9 DoD (cascade edges, WEF section, node WEF context, tests/build green, synced) → Tasks 5, 6, 7. ✓

**Placeholder scan:** No TBD/TODO; all code shown in full; commands explicit. ✓

**Type consistency:** `SectorCascade {from,to,rationale,strength}` defined Task 1, used Task 2. `WefInsight {id,title,summary,url,sector?,source,published,provenance}` defined Task 3, used Tasks 3/4/5/6. `TopoEdge.kind` adds `"cascade"` Task 2, rendered Task 5. `getWefInsights`/`readJson` export consistent Task 3. `wefInsights` prop name consistent Tasks 5/6. ✓

**Known caveats flagged inline:** `readJson` must be exported (Task 3 Step 3); `Badge` children signature must be verified against the real component (Task 4 Step 2); unused `mx`/`my` must be removed (Task 5 Step 2).
