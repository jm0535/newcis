// Plain-English names for each ingest source key. The pipeline writes technical
// keys into last_run.json's `sources_ok` (e.g. "noaa_oni", "hdx_food_security").
// Those keys are for engineers; an executive reading the dashboard should see a
// human-readable feed name ("ENSO / ONI — NOAA"), never the raw key. Single
// source of truth so the status bar dots and the Operations "Data Feeds" card
// always label a source the same way.
//
// `label` is the friendly feed name; `what` is the one-line plain description of
// what that feed provides — used as the secondary line on the Operations card.
export interface SourceMeta {
  label: string;
  what: string;
}

export const SOURCE_META: Record<string, SourceMeta> = {
  noaa_oni: { label: "ENSO / ONI", what: "El Niño–La Niña index · NOAA" },
  noaa_soi: { label: "Southern Oscillation", what: "Pressure index · NOAA" },
  noaa_trade_wind: { label: "Trade winds", what: "Pacific wind anomaly · NOAA" },
  ccsr_nmme: { label: "Seasonal outlook", what: "Multi-model ENSO forecast · NMME" },
  hdx_rainfall: { label: "Rainfall", what: "Provincial rainfall anomaly · HDX" },
  hdx_food_security: { label: "Food security", what: "IPC food-security phase · HDX" },
  nasa_power_soil: { label: "Soil moisture", what: "Land-surface moisture · NASA" },
  neo_ndvi: { label: "Vegetation health", what: "Satellite greenness (NDVI) · NASA" },
  fao_asi: { label: "Agricultural stress", what: "Cropland drought index (ASI) · FAO GIEWS" },
  hdx_acled: { label: "Conflict events", what: "Social-stability signal · ACLED" },
  usgs_earthquakes: { label: "Earthquakes", what: "Seismic activity · USGS" },
  gdacs: { label: "Disaster alerts", what: "Active disaster events · GDACS" },
  gvp_volcanoes: { label: "Volcanoes", what: "Eruption status · Smithsonian GVP" },
  open_meteo: { label: "Weather", what: "Temperature & forecast · Open-Meteo" },
};

// Fallback for any key not in the map: title-case the raw key so a newly added
// source still reads acceptably until it gets a proper label here.
export function sourceLabel(key: string): string {
  return (
    SOURCE_META[key]?.label ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
