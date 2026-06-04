# NEWCIS — Production Architecture (Open-Stack Path)

> **Status:** Reviewable plan / backup architecture. Not yet implemented.
> **Purpose:** Capture the target architecture for taking the NEWCIS PoC to a
> genuine national-scale system on an **open, Linux-native, vendor-portable stack** —
> as an alternative (or successor) to the Power BI + ArcGIS Enterprise path in
> [CLAUDE.md](../CLAUDE.md) §1.
>
> This document does **not** replace the Power BI / ArcGIS recommendation. It sits
> *beside* it as the engineering-led option: the same data-to-decision pipeline,
> built on software the team owns end-to-end. Keep both on the table; this is the
> path for an organisation that staffs developers rather than licences analysts.

---

## 0. Why an open-stack production path exists

The PoC already proves the hard part: a **pure, tested risk engine** turning real
NOAA/HDX/NASA data into an explainable traffic-light operating picture. The gap
between "prototype" and "system" is **infrastructure, not logic** — and that
infrastructure is finite and well-understood.

The trade vs. the vendor stack:

| Dimension | Power BI + ArcGIS Enterprise | Open stack (this doc) |
|---|---|---|
| Operator profile | Analysts, no-code | Developers / platform team |
| Logic transparency | DAX measures (semi-opaque) | TypeScript engine, unit-tested, in git |
| Licensing | Per-seat + Enterprise + credits | Open-source; infra cost only |
| Data sovereignty | Vendor cloud (or costly on-prem) | Self-hostable on national infra |
| Portability | Locked to MS/Esri | Runs on any Linux host / k8s |
| Lock-in risk | High | Low |
| Time-to-first-pixel | Slow (tenancy, modelling) | Fast (already running) |

**Non-negotiable constraint for this plan:** every component must be free /
open-source / self-hostable. No mandatory paid SaaS. (Managed equivalents are
noted as optional conveniences, never requirements.)

---

## 1. Target architecture (three tiers, unchanged in spirit)

```
┌─ INGEST ──────────────┐   ┌─ INTELLIGENCE ────────┐   ┌─ PRESENT ─────────────┐
│ Scheduled job          │   │ Risk engine (pure TS)  │   │ Next.js dashboard      │
│ (systemd timer /       │──▶│ + validation (Zod)     │──▶│ + REST/RPC read API    │
│  container CronJob)     │   │ + national rollup      │   │ + SITREP renderer      │
│ NOAA · HDX · NASA       │   │                        │   │ MapLibre + Recharts    │
└────────┬───────────────┘   └───────────┬────────────┘   └───────────┬───────────┘
         │ transactional upsert           │ reads                       │ reads
         ▼                                ▼                             ▼
   ┌───────────────────────── PostgreSQL + PostGIS ─────────────────────────┐
   │ indicators · readings_history · sector_risk · national_status ·         │
   │ risk_thresholds · sitreps · ingest_runs (audit) · provinces (geometry)  │
   └────────────────────────────────────────────────────────────────────────┘
```

The PoC's **decoupling principle survives**: ingestion writes to the store, the
dashboard only reads. Nothing in the presentation tier blocks on an upstream API.

---

## 2. Persistence — PostgreSQL + PostGIS

**Replaces:** the `/data/*.json` file store.

The PoC's data shapes ([CLAUDE.md §3](../CLAUDE.md), `src/lib/types.ts`) were
deliberately defined as typed interfaces so a database can adopt them without an
app rewrite. The migration is: create tables matching those shapes, point the
read helpers (`src/lib/data.ts`) at the DB, have ingestion upsert instead of
writing files.

**Why Postgres + PostGIS specifically:**
- **PostGIS** turns province geometry into real spatial data. Today the map joins
  `sector_risk.json` to `provinces.geojson` client-side; with PostGIS, spatial
  queries ("which provinces intersect this drought polygon?") become server-side
  SQL. Scales past the 4-province slice to all 22 — and beyond — without code.
- **ACID transactions** fix the audit's #1 gap: concurrent ingests can no longer
  corrupt state. An ingest cycle becomes one transaction — all-or-nothing.
- **Query-time history** — the 12-month trend lines become indexed time-series
  queries instead of a growing append-only JSON array.
- **Open + self-hostable** — runs on any Linux box; no licence.

**Schema sketch** (mirrors `types.ts`):

| Table | Maps to PoC file | Notes |
|---|---|---|
| `indicators` | `indicators.json` | latest reading per key; `provenance` enum |
| `readings_history` | `readings_history.json` | time-series, indexed on `(key, observed_at)` |
| `risk_thresholds` | `risk_thresholds.json` | engine config; editable via admin UI later |
| `sector_risk` | `sector_risk.json` | `(province_code, sector)` composite; `level` enum |
| `national_status` | `national_status.json` | single current row + history |
| `sitreps` | `data/sitreps/` | generated reports; `html` + `summary` |
| `ingest_runs` | `last_run.json` | **audit trail** — replaces git-as-log; per-source success, durations, errors |
| `provinces` | `public/provinces.geojson` | `geometry(MultiPolygon, 4326)` via PostGIS; `code`, `name`, `is_focus`, `population` |

**Access layer:** Drizzle ORM (TypeScript-first, thin, generates types from
schema) or Prisma. Reads stay behind the same `src/lib/data.ts` interface so the
risk engine and UI are untouched.

**Backup/DR:** `pg_dump` to national object storage on a cron; point-in-time
recovery via WAL archiving. (The git-as-audit-trail trick was clever for a PoC
but is not a backup strategy.)

---

## 3. Validation — Zod at every boundary

**Fixes audit gap #2** (raw `JSON.parse` + casts on external responses).

The risk engine is only as trustworthy as its inputs. Today the ingest modules
(`ingest/sources/*.ts`) cast NOAA/HDX/NASA responses with no runtime guard — a
schema change upstream corrupts a cycle silently.

- **Define a Zod schema per external source** (ONI text product, HDX HAPI row,
  NASA POWER response). Parse, don't cast. On schema drift → the source fails
  *loudly* and is flagged in `ingest_runs`, rather than poisoning the store.
- **Validate API route inputs** (`/api/ingest`, `/api/sitrep`) with Zod.
- **Validate DB reads** at the `data.ts` boundary so a bad row can't reach the
  engine.

This is the single highest-leverage hardening step — it protects the part that's
already good (the engine) from the part that's inherently untrustworthy (other
people's APIs).

---

## 4. Ingestion — containerised, transactional, resilient

**Fixes audit gaps #5 (no retry/recovery)** and keeps the decoupling.

- **Scheduler:** the PoC's GitHub Action becomes a **systemd timer** (simplest
  self-host) or a **k8s CronJob** (if clustered). 6-hourly cadence unchanged.
- **Transactional writes:** one ingest = one DB transaction. Partial source
  failure no longer writes partial state.
- **Per-source retry + timeout + circuit-breaker:** the `run<T>()` wrapper in
  `ingest/lib.ts` already isolates failures; add bounded retry with backoff and
  a per-source timeout. A flaky NOAA endpoint degrades to "last-good + flagged",
  never blanks the dashboard.
- **Idempotency:** upserts keyed on `(metric, observed_at)` so a re-run is safe.
- **Provenance enforcement:** `LIVE` requires a successful fetch *this cycle*;
  stale data is auto-downgraded with an "as-of" age, surfaced in the UI.

---

## 5. Read API & presentation

**Largely keep the PoC** — this tier is already the strongest.

- **Next.js 16 App Router** stays. Server Components read from Postgres via
  `data.ts` (swap fs reads for DB queries; same function signatures).
- **REST/RPC read endpoints** for any external consumer (other agencies pulling
  the national status). Versioned (`/api/v1/...`), read-only, cacheable.
- **MapLibre GL** stays — and gains PostGIS-backed GeoJSON (see §8 for the
  Living Atlas basemap/boundary additions).
- **Recharts** stays for gauges/trends.
- **Design system** (`docs/design-system.md`) stays — it's production-grade.

---

## 6. Auth & security

**Fixes audit gaps #3 (world-writable ingest) and #8 (secret in git).**

- **Public read-only stays** for the dashboard (the concept's intent).
- **RBAC for mutations:** Auth.js (NextAuth) or Better Auth — both open,
  self-hostable. `/api/ingest`, threshold edits, and SITREP generation move
  behind authenticated roles (`analyst`, `admin`).
- **Rate limiting** on all `/api` routes (e.g. a Postgres- or Redis-backed
  limiter) — closes the DOS surface on `/api/ingest`.
- **Secrets:** rotate `HDX_APP_ID`; move to host env / CI secrets / a vault
  (e.g. self-hosted Infisical or `sops`-encrypted files). **Purge the committed
  `.env.local` from git history** (`git filter-repo`).
- **Signed ingest commits / row checksums** so tampering is detectable.

---

## 7. Observability, CI/CD, testing

**Fixes audit gaps #4, #6, #7.**

**Observability:**
- **Structured logging** (Pino) — JSON logs with correlation IDs, not `console.log`.
- **Health endpoints:** `/api/health` (liveness), `/api/ready` (DB reachable +
  last ingest fresh). Ops can monitor without scraping `last_run`.
- **Metrics:** Prometheus endpoint — ingest duration per source, request latency,
  data-freshness gauges. Grafana dashboards (both self-hostable).
- **Error tracking:** self-hosted GlitchTip or Sentry (open-source edition).

**CI/CD (self-hostable, no paid SaaS required):**
- Gates on every change: **lint → typecheck → test → build**. The PoC has the
  scripts; they just aren't enforced as gates.
- Options that avoid GitHub billing: **Forgejo Actions / Gitea Actions** (self-host),
  **Woodpecker CI**, or **Drone** — all run the same pipeline on your own box.
- **Container build** → push to a self-hosted registry → staged deploy.

**Testing (extend beyond the engine):**
- Keep the strong `tests/risk-engine.test.ts` (21 cases).
- Add: **ingest-source tests** (fixture the external responses, assert
  normalisation), **API route tests**, **component tests** (Vitest + Testing
  Library), and a thin **E2E** smoke (Playwright) for the four pages.

---

## 8. Mapping & geospatial — open basemaps + optional Living Atlas

The PoC uses **MapLibre GL** with **keyless XYZ raster basemaps** (OSM,
OpenTopoMap, Esri World Imagery). This is already the right open-stack choice —
no ArcGIS Enterprise needed. Two enhancements, both **free and keyless**:

**8.1 PostGIS-backed boundaries.** Serve province geometry from PostGIS as
GeoJSON (or vector tiles via `pg_tileserv` / Martin — both open) instead of a
static file. The map join becomes a spatial query.

**8.2 ArcGIS Living Atlas — usable *without* an ArcGIS subscription.** Living
Atlas is Esri's curated layer collection, hosted as standard **ArcGIS REST
services on ArcGIS Online**. Crucially, **Public-tier** content is **anonymous,
keyless, and CORS-enabled** (`access-control-allow-origin: *`), so MapLibre can
consume it directly — no Esri SDK, no token, no credits. (Verified live: vector
tiles and anonymous GeoJSON queries both return HTTP 200 with open CORS.)

What we can genuinely use today, at zero cost:

| Use | Living Atlas service | Type | MapLibre consumption |
|---|---|---|---|
| Satellite basemap | `World_Imagery` | MapServer tiles | `raster` source — `…/MapServer/tile/{z}/{y}/{x}` (already in PoC) |
| Vector basemap | `World_Basemap_v2` | VectorTileServer | load `…/VectorTileServer/resources/styles/root.json` as the style |
| Boundary fallback | `World_Administrative_Divisions` | FeatureServer | `geojson` source — `…/FeatureServer/0/query?where=ISO_CC='PG'&outFields=*&outSR=4326&f=geojson` |

**Tiers to avoid:** *Subscriber* and *Premium* Living Atlas layers require a
signed-in ArcGIS org account (and Premium burns credits). Never wire those in.

**Honest verdict (full detail in the Living Atlas research below):** Living Atlas
adds two cosmetic basemaps and a boundary fallback — nice-to-haves that slot into
the existing MapLibre stack. It does **not** replace NOAA/NASA/HDX ingestion for
the actual climate indicators; those remain the real `LIVE` sources. **Treat any
Living Atlas basemap as cosmetic infrastructure, never as a `LIVE` data badge.**

---

## 9. Deployment topology (self-hosted, sovereign)

```
┌──────────────── National Linux host / on-prem cluster ─────────────────┐
│  Reverse proxy (Caddy / nginx, auto-TLS)                                │
│     ├── Next.js app (container)            ← reads Postgres             │
│     ├── Ingest job (systemd timer / CronJob) → writes Postgres          │
│     ├── PostgreSQL + PostGIS (container/host) + WAL archiving            │
│     ├── Martin / pg_tileserv (optional vector tiles)                    │
│     └── Prometheus + Grafana + GlitchTip (observability)                │
│  Backups → national object storage (pg_dump + WAL)                      │
└─────────────────────────────────────────────────────────────────────────┘
```

A single capable VM runs all of it for a 22-province workload. Orchestration
(k8s/Nomad) is optional and only justified at multi-node scale. **No managed SaaS
is required** — every box above is open-source and runs on national
infrastructure, satisfying data-sovereignty requirements a vendor cloud cannot.

---

## 10. Phased migration (each phase ships independently)

The PoC keeps working throughout — no big-bang rewrite.

1. **Foundation:** stand up Postgres + PostGIS; port schema from `types.ts`;
   swap `data.ts` reads to the DB behind the same interface. Add Zod validation
   at the ingest + API boundaries.
2. **Ingest hardening:** containerise the job; transactional upserts; retry +
   provenance enforcement; `ingest_runs` audit table.
3. **Security:** Auth.js RBAC on mutations; rate limiting; rotate + vault
   secrets; purge `.env.local` from history.
4. **Observability + CI:** Pino logs; health/metrics endpoints; Grafana;
   self-hosted CI with lint/typecheck/test/build gates.
5. **Test depth:** ingest-source, API, component, and E2E coverage.
6. **Geospatial polish:** PostGIS-served boundaries; optional Living Atlas
   vector basemap; spatial queries for the full province set.

---

## 11. Relationship to the vendor path

This is **not a rejection** of Power BI + ArcGIS — it's the parallel option for a
developer-staffed deployment. The two can even coexist: the open stack as the
authoritative pipeline + sovereign store, with a Power BI report pointed at the
same Postgres for analysts who prefer it, and ArcGIS Online consuming the PostGIS
layers if a unit standardises on Esri tooling. The data shapes in
[CLAUDE.md §3](../CLAUDE.md) are the contract both honour.

The decision is organisational, not technical: **who operates the system, and
who owns the stack.** This document ensures the open answer is fully specified
and ready to execute if that's the call.
