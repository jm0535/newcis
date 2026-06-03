// One sector panel for Page 3. Shows lead agency, per-focus-province risk cells,
// trend glyphs, the driving indicators (so "why high?" is one glance), and the
// dominant provenance for the whole panel.
import type { Indicator, Provenance, SectorRisk, Trend } from "@/lib/types";
import type { SectorMeta } from "@/lib/sectors";
import { ProvenanceBadge } from "./Provenance";
import { RISK_BG_CLASS, TREND_GLYPH } from "@/lib/ui";

const FOCUS: { code: string; label: string }[] = [
  { code: "PG08", label: "Enga" },
  { code: "PG09", label: "Western H." },
  { code: "PG07", label: "Southern H." },
  { code: "PG02", label: "Gulf" },
];

function dominantProvenance(rows: SectorRisk[]): Provenance {
  return rows.some((r) => r.provenance === "LIVE") ? "LIVE" : "DEMO";
}

function dominantTrend(rows: SectorRisk[]): Trend {
  const score = { up: 0, down: 0, flat: 0 };
  for (const r of rows) score[r.trend]++;
  return (Object.entries(score).sort((a, b) => b[1] - a[1])[0]?.[0] as Trend) ?? "flat";
}

export function SectorPanel({
  meta,
  sectorRisk,
  indicators,
}: {
  meta: SectorMeta;
  sectorRisk: SectorRisk[];
  indicators: Indicator[];
}) {
  const rows = sectorRisk.filter((r) => r.sector === meta.sector);
  const byCode = new Map(rows.map((r) => [r.province_code, r]));
  const provenance = rows.length ? dominantProvenance(rows) : "DEMO";
  const trend = rows.length ? dominantTrend(rows) : "flat";
  const driverInds = meta.drivers
    .map((k) => indicators.find((i) => i.key === k))
    .filter((x): x is Indicator => Boolean(x));

  return (
    <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30 flex flex-col gap-3">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-100">{meta.sector}</div>
          <div className="text-[11px] text-zinc-500 truncate">{meta.lead_agency}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <ProvenanceBadge value={provenance} />
          <span className="text-xs text-zinc-400">{TREND_GLYPH[trend]}</span>
        </div>
      </header>

      <p className="text-[11px] leading-snug text-zinc-400">{meta.description}</p>

      <div className="grid grid-cols-4 gap-1">
        {FOCUS.map((p) => {
          const r = byCode.get(p.code);
          if (!r) {
            return (
              <div
                key={p.code}
                className="text-center px-1 py-1.5 rounded border border-dashed border-zinc-700 text-zinc-600 text-[10px]"
              >
                <div>{p.label}</div>
                <div>—</div>
              </div>
            );
          }
          return (
            <div
              key={p.code}
              title={`${r.provenance} · ${r.data_source ?? "engine"}`}
              className={`text-center px-1 py-1.5 rounded border ${RISK_BG_CLASS[r.level]}`}
            >
              <div className="text-[10px] uppercase tracking-wider opacity-80">{p.label}</div>
              <div className="text-[11px] font-semibold uppercase mt-0.5">
                {r.level} <span className="opacity-70">{TREND_GLYPH[r.trend]}</span>
              </div>
            </div>
          );
        })}
      </div>

      {driverInds.length > 0 && (
        <div className="text-[11px] text-zinc-500 pt-2 border-t border-zinc-800">
          <span className="uppercase tracking-wider text-zinc-600 mr-1">Drivers:</span>
          {driverInds.map((d, i) => (
            <span key={d.key}>
              <span className="text-zinc-300 font-mono">{d.key}</span>
              <span className="text-zinc-500"> {d.value === null ? "—" : d.value}{d.unit ? "" : ""}</span>
              {i < driverInds.length - 1 && <span className="text-zinc-700"> · </span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
