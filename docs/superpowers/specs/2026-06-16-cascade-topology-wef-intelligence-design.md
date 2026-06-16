# Cascade Topology + WEF Strategic Intelligence — Design

**Date:** 2026-06-16
**Status:** Approved (brainstorming → ready for implementation plan)
**Page affected:** `/topology` (Risk Topology)

---

## 1. Problem

The current Risk Topology map is a pure projection of the engine's own wiring
(indicator → sector → centre). It re-renders information the dashboard already
shows. It does **not** deliver the WEF Strategic Intelligence "neural map"
inspiration: **interconnected nodes showing how risks drive _each other_** —
cross-domain causal chains with a plain-language "why" on each link.

Two gaps:

1. **No sector→sector cascade layer.** Every path is depth-1 (indicator → sector
   → centre). The cascade web (e.g. Water Security → Public Health) is missing.
2. **No WEF context.** PNG's PM and delegation recently attended the World
   Economic Forum; surfacing genuine WEF risk framing tied to NEWCIS sectors is
   a high-value, executive-facing win.

## 2. Goals

- Add a **cascade layer**: curated sector→sector causal edges with rationale,
  rendered on the existing radial graph — the "neural" reveal.
- Add a **WEF Strategic Intelligence** section: real, citable WEF insights linked
  to their public pages, tied to NEWCIS sectors.
- Preserve the **NEWCIS honesty contract**: invent no new risk; never present
  DEMO as LIVE; never lift paywalled/login-gated content.

## 3. Non-goals

- **No engine change.** `scoreSector` / `rollUpNational` are untouched. Cascades
  do NOT re-score any sector (that is option B — explicitly deferred; see §7).
- **No scraping of WEF's app / login-gated Strategic Intelligence.** WEF blocks
  bots (403) and that content is licensed per-account. We use only WEF's openly
  published, citable outputs and link out to them.
- **No live WEF API now.** Seeded DEMO content, structured for a later API swap.

## 4. Architecture

Three additions to `/topology`, all **pure view-layer**:

1. **Cascade layer** — sector→sector edges drawn on the radial graph; dashed,
   curved, distinct hue; badged `REFERENCE`. No rescore.
2. **WEF panel (placement B)** — standing "WEF Strategic Intelligence" section
   below the graph; tiles from `data/wef_insights.json`; DEMO-badged; each tile
   links to a real public WEF URL.
3. **WEF-in-drill (placement C)** — clicking a sector node surfaces that sector's
   matching WEF insight inside the existing drill panel.

New files:

| File | Purpose | Provenance |
|---|---|---|
| `src/lib/cascades.ts` | `SECTOR_CASCADES` map (code + rationale; no external data) | REFERENCE |
| `data/wef_insights.json` | Seeded WEF excerpts + verified links | DEMO |

Modified files: `src/lib/topology.ts`, `src/components/RiskTopology.tsx`,
`src/app/topology/page.tsx`, plus one new component
`src/components/WefStrategicIntelligence.tsx`.

## 5. Cascade layer

### 5.1 Data shape — `src/lib/cascades.ts`

```ts
import type { Sector } from "./types";

export interface SectorCascade {
  from: Sector;          // upstream driver sector
  to: Sector;            // downstream affected sector
  rationale: string;     // plain-language "why" (the WEF payoff)
  strength: "weak" | "moderate" | "strong";  // reserved for future engine wiring
}

export const SECTOR_CASCADES: SectorCascade[] = [ /* curated, ~6–8 edges */ ];
```

`strength` is **unused by the view** — it is reserved so a later engine-wired
version (option B) can drop in as a bounded amplifier without a rewrite.

### 5.2 Seed edges (domain-grounded, real causal logic)

| from | to | strength | rationale |
|---|---|---|---|
| Water Security | Public Health | strong | Water scarcity and contamination raise waterborne-disease risk. |
| Food Security | Social Stability | strong | Food shortages and price spikes drive unrest and displacement. |
| Disaster & Hazard | Infrastructure | moderate | Seismic/flood events damage roads, power, and water systems. |
| Economic Stability | Food Security | moderate | Economic shock erodes import capacity and household purchasing power. |
| Infrastructure | Energy Security | moderate | Damaged transport/grid disrupts fuel and power delivery. |
| Public Health | Social Stability | weak | Health-system strain compounds social pressure. |

(Final sector names validated against `Sector` type during implementation; the
list above is indicative. Adjust to the exact union in `src/lib/types.ts`.)

### 5.3 Render

In `topology.ts`:
- `buildTopology` emits a new edge `kind: "cascade"` for each `SECTOR_CASCADES`
  entry **where both sectors are present as ring-2 nodes**.
- Cascade edge `level` = the downstream (`to`) sector's level, so a cascade into
  a hot sector reads hot (weights edge opacity, consistent with existing edges).

In `RiskTopology.tsx`:
- Cascade edges render **curved** (arc between two outer-ring sector nodes) +
  **dashed** + a **distinct hue** — visually separate from radial driver/rollup
  lines.
- Legend gains a "risk cascade (REFERENCE)" entry.
- Click a sector node → its cascade edges and downstream chain light up (the
  neural reveal); drill panel lists "drives →" and "driven by ←" with rationale.

### 5.4 Honesty

Cascade edges are badged `REFERENCE` in the legend and drill panel. They show a
**true causal relationship**, explicitly **not** a rescore. Under-claims (safe).

## 6. WEF Strategic Intelligence

### 6.1 Data shape — `data/wef_insights.json`

```ts
interface WefInsight {
  id: string;
  title: string;          // real WEF headline
  summary: string;        // paraphrase, NOT verbatim (copyright); <=15-word quote max if any, attributed
  url: string;            // verified public WEF link (opens new tab)
  sector?: Sector;        // for node-drill match (placement C); omit = national-level
  source: string;         // e.g. "WEF Global Risks Report 2025", "WEF Agenda"
  published: string;      // date
  provenance: "DEMO";     // honest now; LIVE later via API
}
```

### 6.2 Seed content — verified live WEF URLs

All URLs confirmed to resolve (browser-accessible; WEF's bot-fetcher returns 403
but the public pages are live and link-safe):

| URL | Maps to | Note |
|---|---|---|
| `https://www.weforum.org/stories/2026/06/the-coming-el-nino-is-more-than-a-climate-event-it-is-a-systemic-shock/` | Centre / ENSO | 2026, current — El Niño as systemic shock. Headline tile. |
| `https://www.weforum.org/stories/2023/06/el-nino-weather-impact-food-production/` | Food Security | El Niño → food production; names PNG highlands droughts. |
| `https://www.weforum.org/publications/global-risks-report-2025/digest/` | National rollup | Extreme weather = #1 ten-year risk. |
| `https://www.weforum.org/press/2025/01/global-risks-report-2025-conflict-environment-and-disinformation-top-threats/` | Social Stability / Disaster | Top threats press release. |
| `https://www.weforum.org/stories/2025/02/securing-water-through-the-power-of-multi-stakeholder-action/` | Water Security | Water risk multi-stakeholder action. |
| `https://www.weforum.org/stories/2023/06/global-food-security-during-a-polycrisis/` | Food / Economic | Polycrisis framing. |
| `https://www.weforum.org/stories/2024/08/asia-pacific-sdgs-climate-poverty-hunger-action/` | National / Pacific | Asia-Pacific climate + hunger. |

Summaries are **paraphrased**, attributed to WEF. No copied body text. No
paywall/login content.

### 6.3 Render B — standing section

`src/components/WefStrategicIntelligence.tsx`, placed below the graph in
`topology/page.tsx`, above the footer:
- Section header "WEF Strategic Intelligence" + `DEMO` badge + "Source: World
  Economic Forum" note.
- Grid of tiles (use `Card` primitive): title, paraphrased summary, source/date,
  and a **"Read on weforum.org →"** external link
  (`target="_blank" rel="noopener noreferrer"`).
- The 2026 El Niño "systemic shock" tile spans wide as the headline.

### 6.4 Render C — node drill

In the existing `RiskTopology` drill panel: when a sector node is selected, if a
`wef_insights.json` row has a matching `sector`, show a compact "WEF context"
block (title + external link).

### 6.5 Honesty + upgrade path

- Every tile `DEMO`-badged; links go to real WEF pages; summaries paraphrased +
  attributed.
- `data/wef_insights.json` shape is API-ready: a later WEF licence/API swaps the
  seed for `LIVE` rows without a render change. (Phase-2; matches NEWCIS's
  documented DEMO→LIVE pattern. A personal WEF account does NOT authorize
  scraping login-gated content; only an official embedding licence/API does.)

## 7. Deferred — option B (engine-wired cascades)

A later upgrade may wire `SECTOR_CASCADES.strength` into `scoreSector` as a
bounded second-order amplifier (e.g. critical Water Security raises Public Health
score). **Deferred** because it requires:
- De-duplication vs `SECTOR_DRIVERS` (a shared upstream indicator must not hit a
  downstream sector twice — the double-counting / fake-risk trap).
- Threshold re-baseline.
- New engine unit tests proving no inflation.

The `strength` field exists now so B drops in without reshaping data.

## 8. Testing

- `tests/cascades.test.ts` — `SECTOR_CASCADES` integrity: valid `Sector`
  endpoints, no self-loops, no duplicate edges.
- Extend `tests/topology.test.ts`: `buildTopology` emits `kind: "cascade"` edges
  only when both endpoints are present; cascade edge `level` = downstream level;
  no cascade edge rescores any node (sector node levels unchanged with/without
  cascades).
- WEF insights: a small shape/lint test that every `url` is https + weforum.org,
  every tile `provenance === "DEMO"`.

## 9. Definition of done

- Topology shows curved dashed REFERENCE cascade edges between sectors with
  rationale on click; the neural reveal lights the downstream chain.
- A "WEF Strategic Intelligence" section sits below the graph with ~7 DEMO tiles
  linking to real WEF pages; the 2026 El Niño piece is the headline.
- Clicking a sector node shows its WEF context block when one exists.
- All tests green; build green. Engine untouched; no DEMO-as-LIVE; no copied WEF
  text. Committed + pushed (local + remote in sync).
