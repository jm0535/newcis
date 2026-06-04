// National risk matrix — sectors × focus provinces, traffic-light coloured.
// Reading "Why is Enga red?" reduces to one row + its data_source caption.
import type { SectorRisk, Sector } from "@/lib/types";
import { TREND_GLYPH } from "@/lib/ui";
import { FOCUS_PROVINCES } from "@/lib/focus-provinces";
import { StatusPill } from "./ui";

const SECTORS: Sector[] = [
  "Food Security",
  "Water Security",
  "Public Health",
  "Economic Stability",
  "Infrastructure",
  "Energy Security",
  "Social Stability",
  "Disaster & Hazard",
];

const FOCUS: { code: string; label: string }[] = FOCUS_PROVINCES.map((p) => ({
  code: p.code,
  label: p.shortLabel,
}));

const RISK_STATUS = {
  low: "green",
  med: "amber",
  high: "red",
  critical: "black",
} as const;

export function RiskMatrix({ sectorRisk }: { sectorRisk: SectorRisk[] }) {
  const byKey = new Map(sectorRisk.map((r) => [`${r.province_code}::${r.sector}`, r]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-y-1.5 border-spacing-x-1">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.08em] text-text-muted font-semibold">
            <th className="text-left font-medium pl-2 pb-2">Sector</th>
            {FOCUS.map((p) => (
              <th key={p.code} className="font-medium text-center px-2 pb-2">
                {p.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SECTORS.map((sector) => (
            <tr key={sector}>
              <td className="text-text-1 pl-2 pr-3 py-1 font-medium whitespace-nowrap">
                {sector}
              </td>
              {FOCUS.map((p) => {
                const r = byKey.get(`${p.code}::${sector}`);
                if (!r) {
                  return (
                    <td key={p.code} className="text-center">
                      <span className="inline-block w-full px-2 py-1.5 rounded-md border border-dashed border-border-default text-text-disabled text-xs">
                        —
                      </span>
                    </td>
                  );
                }
                return (
                  <td key={p.code} className="text-center">
                    <span
                      title={`${r.provenance} · ${r.data_source ?? ""}`}
                      className="inline-flex items-center justify-center gap-1.5 w-full"
                    >
                      <StatusPill status={RISK_STATUS[r.level]} size="sm">
                        {r.level}
                        <span className="opacity-80 text-[9px]" data-numeric>
                          {TREND_GLYPH[r.trend]}
                        </span>
                      </StatusPill>
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
