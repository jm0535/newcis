# NEWCIS — National ENSO Early Warning & Climate Intelligence System

> Proof-of-concept prototype for Papua New Guinea. See [CLAUDE.md](./CLAUDE.md) for the
> single source of truth on architecture, scope, and build order.
> Task tracking lives in [BUILD_CHECKLIST.md](./BUILD_CHECKLIST.md).

A three-tier data-to-decision pipeline:

```
INGEST (NOAA, BoM, HDX HAPI) → INTELLIGENCE (risk engine, traffic-light) → PRESENT (Next.js dashboard + SITREP)
```

## Stack
- **Next.js 16** (App Router, Tailwind v4, Turbopack)
- **MapLibre GL** for the provincial heat map
- **GitHub Actions** for scheduled ingestion (commits JSON back to the repo)
- **Vercel** for hosting at `newcis.in4metrix.dev`
- **No DB in the PoC** — versioned JSON files in `/data/` are the store.

## Local dev

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # production build
pnpm lint
```

## Repo layout

```
src/app/            Next.js routes (App Router)
src/lib/types.ts    Data shapes (JSON store + future DB share these)
src/lib/data.ts     Server-side read helpers
data/               JSON store — written by the ingestion Action
  risk_thresholds.json   Traffic-light bands (retunable, no code change)
  risk_thresholds.md     Rationale for each band
public/provinces.geojson  PNG admin-1 boundaries (built by scripts/)
scripts/            One-off build scripts (GeoJSON, HDX bootstrap)
```

## Deploying to Vercel

The PoC needs **no data env vars on Vercel** — the app reads static files committed to the
repo. Secrets like `HDX_APP_ID` belong on the **GitHub Actions** side (the ingestion pipeline),
not Vercel.

Steps:

1. Push this repo to GitHub (already wired to `git@github.com:jm0535/newcis.git`).
2. In Vercel: **New Project → Import** the `jm0535/newcis` repo. Framework preset: **Next.js**.
3. Build settings (defaults): `pnpm install`, `pnpm build`, output `.next`.
4. Add the custom domain `newcis.in4metrix.dev` under **Project → Domains** and set the
   recommended CNAME / A record at the DNS provider.
5. Confirm the first deploy is green. Subsequent pushes (including the ingestion Action's
   commits to `/data`) auto-trigger redeploys.

## Why ingestion runs on GitHub Actions, not Vercel
NOAA/NASA endpoints can take 30+ seconds; Vercel serverless functions time out at 10–60s.
The Action does the slow pulls, computes risk via the engine, **commits the resulting JSON**,
and the commit triggers a Vercel redeploy. Vercel itself only ever reads static files — so the
executive demo is always fast and never blocks on an upstream API. Git history *is* the audit
trail (no separate runs table needed at PoC scale).

## Build status
See [BUILD_CHECKLIST.md](./BUILD_CHECKLIST.md). Currently: **Phase 0 + Phase 1 partial.**
