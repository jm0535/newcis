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
- **Local cron + manual Refresh button** for ingestion (commits JSON back to the repo). GitHub Actions workflow is checked in as `.disabled` — see "Ingestion" below.
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

## Ingestion

Ingestion is decoupled from the dashboard: it writes JSON files to `/data`, commits them,
and the commit triggers a Vercel redeploy. Vercel itself only ever reads static files — so
the demo is always fast and never blocks on an upstream API. Git history *is* the audit
trail (no runs table needed at PoC scale).

The same `runIngest()` library (`ingest/lib.ts`) is reachable two ways:

**Option 1 — local cron (silent autopilot between demos).** Add a crontab line on your dev
machine:

```cron
0 */6 * * * cd ~/Documents/workspace/projects/github/newcis && HDX_APP_ID=<your-id> /usr/bin/pnpm ingest && git add data/ && git diff --cached --quiet || (git commit -m "data: ingest $(date -u +%Y-%m-%dT%H:%MZ)" && git push)
```

**Option 2 — manual Refresh button (on stage).** The dashboard exposes a Refresh button that
calls `/api/ingest`, which invokes `runIngest()` server-side. Punchy for live demos: you
trigger a real pull in front of the audience. (Wired up when Page 1 / Page 4 land.)

**Why not GitHub Actions?** The workflow is checked in at
`.github/workflows/ingest.yml.disabled` and is the natural production path. It is disabled in
this PoC because the repo owner's GitHub billing is currently locked; rename to `.yml` to
re-enable when billing clears.

**Why not Vercel Cron / functions?** NOAA + HDX pulls can take 30+ seconds and Vercel
serverless functions time out at 10–60s. Doing the pull outside Vercel keeps presentation
fast and decoupled.

## Build status
See [BUILD_CHECKLIST.md](./BUILD_CHECKLIST.md). Currently: **Phase 0 + Phase 1 partial.**
