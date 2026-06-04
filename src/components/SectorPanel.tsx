// One sector panel for Page 3. Shows lead agency, per-focus-province risk cells,
// trend glyphs, the driving indicators (so "why high?" is one glance), and the
// dominant provenance for the whole panel.
import type { Indicator, Provenance, SectorRisk, Trend } from "@/lib/types";
import type { SectorMeta } from "@/lib/sectors";
import { ProvenanceBadge } from "./Provenance";
import { Card, StatusPill } from "./ui";
import { TREND_GLYPH } from "@/lib/ui";

const FOCUS: { code: string; label: string }[] = [
  { code: "PG08", label: "Enga" },
  { code: "PG09", label: "Western H." },
  { code: "PG07", label: "Southern H." },
  { code: "PG02", label: "Gulf" },
];

const RISK_STATUS = {
  low: "green",
  med: "amber",
  high: "red",
  critical: "black",
} as const;

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
    <Card padding="md" className="flex flex-col gap-3">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text-1">{meta.sector}</div>
          <div className="text-[11px] text-text-muted truncate">{meta.lead_agency}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <ProvenanceBadge value={provenance} />
          <span className="text-base text-text-2" data-numeric>
            {TREND_GLYPH[trend]}
          </span>
        </div>
      </header>

      <p className="text-[11px] leading-snug text-text-2">{meta.description}</p>

      <div className="grid grid-cols-4 gap-1.5">
        {FOCUS.map((p) => {
          const r = byCode.get(p.code);
          if (!r) {
            return (
              <div
                key={p.code}
                className="text-center px-1 py-2 rounded-md border border-dashed border-border-default text-text-disabled text-[10px]"
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
              className="text-center flex flex-col items-center gap-1 px-1 py-2 rounded-md bg-surface-2 border border-border-subtle"
            >
              <div className="text-[10px] uppercase tracking-[0.06em] text-text-muted font-medium">
                {p.label}
              </div>
              <StatusPill status={RISK_STATUS[r.level]} size="sm">
                {r.level}
                <span className="opacity-70 text-[9px]" data-numeric>
                  {TREND_GLYPH[r.trend]}
                </span>
              </StatusPill>
            </div>
          );
        })}
      </div>

      {driverInds.length > 0 && (
        <div className="text-[11px] text-text-muted pt-2 border-t border-border-subtle">
          <div className="uppercase tracking-[0.06em] text-text-disabled mb-1 font-medium">
            What drives this rating
          </div>
          <div className="flex flex-col gap-0.5">
            {driverInds.map((d) => (
              <div key={d.key} className="flex items-baseline justify-between gap-2" title={d.key}>
                <span className="text-text-2 truncate">{d.label}</span>
                <span className="text-text-muted shrink-0" data-numeric>
                  {d.value === null ? "—" : `${d.value} ${d.unit}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
