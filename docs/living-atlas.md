# ArcGIS Living Atlas — Keyless Integration Notes (PoC)

> **Question answered:** Can NEWCIS use ArcGIS Living Atlas content in its
> MapLibre-based, keyless prototype *without* buying ArcGIS Enterprise or a paid
> ArcGIS Online subscription?
>
> **Short answer:** Yes — but only the **Public** tier, and only as **cosmetic
> basemaps + a boundary fallback**. Never as a `LIVE` data source. Verified live
> (HTTP 200, anonymous, CORS `access-control-allow-origin: *`).

---

## 1. What Living Atlas actually is

Esri's curated collection of geospatial content (maps, layers, 3D scenes, apps),
hosted on **ArcGIS Online as standard ArcGIS REST services** — `FeatureServer`,
`MapServer`, `ImageServer`, `VectorTileServer`. Curated by Esri plus vetted
community/agency contributors. Every item has an ArcGIS Online item ID and an
underlying REST service URL.

Content categories: basemaps, imagery, boundaries/places, environment & climate,
demographics, and **Live Feeds** (weather/NOAA, disasters, traffic).

The key insight for us: because it's **plain ArcGIS REST**, you don't need the
Esri JS SDK to consume it. MapLibre can read these services directly.

---

## 2. Access tiers (the billing-critical part)

| Tier | Badge | Account/token? | Credits? | Usable in our keyless PoC? |
|---|---|---|---|---|
| **Public** | none | **No** — anonymous, CORS-enabled | No | ✅ Yes |
| **Subscriber** | "Subscriber" | Yes (signed-in ArcGIS org) | No | ❌ No |
| **Premium** | "Premium" | Yes | **Yes — burns credits** | ❌ No |

Only **Public-tier** content works anonymously. It needs **no API key/token** and
answers anonymous browser `fetch()`. Verified: `services.arcgis.com` and
`services9.arcgis.com` send `access-control-allow-origin: *`, so MapLibre fetches
work straight from the browser — **no proxy needed**.

> ⚠️ Self-hosted third-party ArcGIS *Servers* often lack CORS. ArcGIS *Online*
> (where Living Atlas lives) does not. This distinction matters if you copy a
> service URL from elsewhere.

---

## 3. Consuming ArcGIS services in MapLibre (no Esri SDK)

### Raster / map tiles → MapLibre `raster` source
```
https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}
```
```js
map.addSource("esri-imagery", { type: "raster", tiles: [URL], tileSize: 256 });
```
> ArcGIS uses `{z}/{y}/{x}` — **row before column**. (Our `HeatMap.tsx` already
> uses this for World Imagery.)

### Vector tiles → load as the MapLibre style
The `VectorTileServer` `root.json` is Mapbox-style-spec compliant:
```
…/VectorTileServer/resources/styles/root.json      (style; relative refs resolve to the service)
…/VectorTileServer/tile/{z}/{y}/{x}.pbf            (tiles)
```
Verified keyless: style 200, tile 200 (~83 KB pbf).

### Feature services → GeoJSON → MapLibre `geojson` source
The `query` endpoint emits RFC-7946 GeoJSON directly:
```
…/FeatureServer/{layer}/query?where=1=1&outFields=*&returnGeometry=true&outSR=4326&f=geojson
```
```js
const geojson = await (await fetch(QUERY_URL)).json();
map.addSource("boundaries", { type: "geojson", data: geojson });
```
This is the path to pull boundaries/points into MapLibre. Verified: an anonymous,
CORS-clean query returns PNG admin polygons.

---

## 4. Verified PNG-relevant Public layers

| Use | Service | Type | URL (verified anonymous + CORS) |
|---|---|---|---|
| Satellite basemap | `World_Imagery` | MapServer tiles | `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` |
| Vector basemap | `World_Basemap_v2` | VectorTileServer | `https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/resources/styles/root.json` |
| Admin-1 boundaries | `World_Administrative_Divisions` | FeatureServer | `https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Administrative_Divisions/FeatureServer/0` → append `/query?where=ISO_CC='PG'&outFields=*&outSR=4326&f=geojson` |
| US weather alerts | `NWS_Watches_Warnings_Sampler` | FeatureServer | `https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/NWS_Watches_Warnings_Sampler/FeatureServer` — **US-only, not useful for PNG** |

**Climate layers** (drought/SPEI, IMERG precipitation, NOAA temp anomaly, SST):
they exist in Living Atlas but are mostly **ImageServer raster** layers, awkward
in plain MapLibre (you'd use `exportImage` as a raster source, not `/tile/`). For
this PoC they're **better consumed from their upstream NOAA/NASA sources** — which
[CLAUDE.md §4](../CLAUDE.md) already specifies. Verify each layer's tier badge on
its item page before wiring anything in.

---

## 5. Honest verdict

**Genuinely usable today — anonymous, zero cost, no key:**
- Esri **World Imagery** (raster) — already in the PoC.
- Esri **World vector basemap** — could add as a basemap option.
- **World Administrative Divisions** — keyless FeatureServer→GeoJSON **fallback**
  for boundaries (our primary boundary source remains the HDX/OCHA p-coded
  GeoJSON, because its codes join to HDX HAPI data).

**Requires an account — avoid:** anything badged Subscriber or Premium.

**Not worth it for PNG:** the NWS Live Feeds (US-only).

**Net recommendation:** Living Atlas contributes two safe, keyless basemaps and a
boundary fallback — cosmetic nice-to-haves that slot straight into the existing
XYZ raster + MapLibre `geojson` stack. It does **not** replace NOAA/NASA/HDX
ingestion for the actual climate indicators; those stay the real `LIVE` sources.

**No ArcGIS Developer / Location Platform key is needed for any of the above.** A
free Location Platform account would only matter for Esri's *premium* styled
basemaps — unnecessary here.

> **Provenance rule:** a Living Atlas basemap is cosmetic infrastructure. It is
> **never** a `LIVE` data badge. The credibility rule in CLAUDE.md §0 stands.

---

## 6. If we wire it in (optional PoC task)

Minimal, in keeping with the existing `BASEMAPS` switcher in
`src/components/HeatMap.tsx`:

1. Add an **"Esri Vector"** basemap entry that loads `World_Basemap_v2`'s
   `root.json` as a style layer (or keep the current World Imagery raster).
2. Optionally add a dev-only toggle to source boundaries from the
   `World_Administrative_Divisions` query as a resilience fallback if the static
   GeoJSON ever fails to load.

Neither changes the data pipeline or the provenance model — purely map cosmetics
and redundancy.

---

## Sources
- Living Atlas — [esri.com product page](https://www.esri.com/en-us/arcgis/products/living-atlas) · [livingatlas.arcgis.com](https://livingatlas.arcgis.com/)
- [What is Living Atlas (Enterprise docs)](https://enterprise.arcgis.com/en/portal/latest/use/what-is-living-atlas.htm)
- [Use Living Atlas subscriber content in public apps](https://www.esri.com/arcgis-blog/products/arcgis-living-atlas/mapping/living-atlas-subscriber-content-public-apps)
- [MapLibre GL JS + ArcGIS data (Esri Developer)](https://developers.arcgis.com/maplibre-gl-js/data/)
- [Query (Feature Service/Layer) REST reference](https://developers.arcgis.com/rest/services-reference/query-feature-service-layer-.htm)
- [Putting the "Live" in Living Atlas](https://www.esri.com/arcgis-blog/products/real-time/real-time/putting-the-live-in-living-atlas-of-the-world)
