// One-off: repair the corrupted sector_risk_seed.json and complete it for all 22
// provinces. The seed is the DEMO baseline for GAP sectors (no public API per
// CLAUDE.md §4) — the risk engine overlays live signals on top per province.
//
// We preserve every recoverable existing row (the original 10 provinces have
// rich, province-specific captions worth keeping) and fill in the gap sectors
// for any province that lacks them so the matrix/sector pages read complete.
import { readFileSync, writeFileSync } from "node:fs";
import { ALL_PROVINCES } from "../src/lib/focus-provinces.ts";

const SEED_PATH = "data/sector_risk_seed.json";

// Gap sectors: no public live API exists, so these are DEMO-seeded for every
// province. Food/Water/Disaster & Hazard are engine/live-driven and intentionally
// NOT seeded here (the engine produces them; seeding would be presenting DEMO as
// if it were the live baseline).
const GAP_SECTORS = ["Public Health", "Energy Security", "Infrastructure"];

const AS_OF = "2026-06-06T00:00:00.000Z";

// Generic per-gap-sector DEMO caption for newly-added provinces.
const GENERIC = {
  "Public Health": "DEMO · clinic data lives in NDoH DHIS2 (no public API)",
  "Energy Security": "DEMO · PNG Power has no public feed; rainfall is the live proxy",
  Infrastructure: "DEMO · road/wharf closures land in ReliefWeb text only (no API)",
};

// Recover the existing rows past the corruption artifact.
function recover() {
  let txt = readFileSync(SEED_PATH, "utf8").split("*** End of")[0].trimEnd();
  if (txt.endsWith(",")) txt = txt.slice(0, -1);
  if (!txt.endsWith("]")) txt += "\n]";
  try {
    return JSON.parse(txt);
  } catch (e) {
    console.error("Could not recover existing seed:", e.message);
    return [];
  }
}

const existing = recover();
const byKey = new Map(existing.map((r) => [`${r.province_code}::${r.sector}`, r]));

const out = [];
for (const p of ALL_PROVINCES) {
  for (const sector of GAP_SECTORS) {
    const key = `${p.code}::${sector}`;
    if (byKey.has(key)) {
      out.push(byKey.get(key)); // keep the rich, hand-written row
    } else {
      out.push({
        province_code: p.code,
        sector,
        level: "low",
        score: 0.2,
        trend: "flat",
        provenance: "DEMO",
        as_of: AS_OF,
        data_source: GENERIC[sector],
      });
    }
  }
}

// Stable order: by province (as listed), then gap sector order.
writeFileSync(SEED_PATH, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${out.length} rows for ${ALL_PROVINCES.length} provinces × ${GAP_SECTORS.length} gap sectors.`);
console.log(`(recovered ${existing.length} existing rows, kept ${out.filter((r) => byKey.has(`${r.province_code}::${r.sector}`)).length})`);
