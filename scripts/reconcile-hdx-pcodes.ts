/**
 * Reconcile HDX HAPI admin1 p-codes (PG01–PG22) with the names already in
 * /public/provinces.geojson. HDX is the join key for all sectoral data, so we replace
 * the GADM-derived `code` with the HDX p-code; without this the food-security feed
 * cannot land on the right polygon.
 *
 * Run after build-provinces-geojson.ts. Idempotent.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const APP_ID = process.env.HDX_APP_ID;
if (!APP_ID) {
  console.error("HDX_APP_ID env var required");
  process.exit(1);
}

const ADMIN1_URL = `https://hapi.humdata.org/api/v1/metadata/admin1?location_code=PNG&output_format=json&app_identifier=${APP_ID}`;

type HdxAdmin1 = { code: string; name: string };
type GeoFeature = { type: "Feature"; properties: Record<string, unknown>; geometry: unknown };
type FC = { type: "FeatureCollection"; features: GeoFeature[] };

function canonical(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\bprovince\b/g, "")
    .replace(/\bautonomous region of\b/g, "")
    .replace(/[^a-z]/g, "")
    .trim();
}

async function main() {
  const r = await fetch(ADMIN1_URL);
  if (!r.ok) throw new Error(`HDX admin1: HTTP ${r.status}`);
  const { data } = (await r.json()) as { data: HdxAdmin1[] };

  const byCanonical = new Map(data.map((a) => [canonical(a.name), a.code]));

  // Manual aliases for cases where canonical forms still differ.
  // GeoJSON canonical name → HDX canonical name (when they differ)
  const ALIAS: Record<string, string> = {
    oro: "northern",
  };

  const geoPath = path.join(process.cwd(), "public", "provinces.geojson");
  const fc = JSON.parse(await fs.readFile(geoPath, "utf8")) as FC;

  let matched = 0;
  const unmatched: string[] = [];
  for (const f of fc.features) {
    const name = f.properties.name as string;
    const aliasKey = ALIAS[canonical(name)] ?? canonical(name);
    const hdxCode = byCanonical.get(aliasKey);
    if (hdxCode) {
      f.properties.code = hdxCode;
      matched += 1;
    } else {
      unmatched.push(name);
    }
  }

  await fs.writeFile(geoPath, JSON.stringify(fc));
  console.log(`Matched ${matched}/${fc.features.length} provinces to HDX p-codes`);
  if (unmatched.length) console.log("Unmatched:", unmatched);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
