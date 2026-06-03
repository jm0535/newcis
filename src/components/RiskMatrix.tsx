// National risk matrix — sectors × focus provinces, traffic-light coloured.
// Reading "Why is Enga red?" reduces to one row + its data_source caption.
import type { SectorRisk, Sector } from "@/lib/types";
import { RISK_BG_CLASS, TREND_GLYPH } from "@/lib/ui";

const SECTORS: Sector[] = [
  "Food Security",
  "Water Security",
  "Public Health",
  "Economic Stability",
  "Infrastructure",
  "Energy Security",
  "Social Stability",
];

const FOCUS: { code: string; label: string }[] = [
  { code: "PG08", label: "Enga" },
  { code: "PG09", label: "Western H." },
  { code: "PG07", label: "Southern H." },
  { code: "PG02", label: "Gulf" },
];

export function RiskMatrix({ sectorRisk }: { sectorRisk: SectorRisk[] }) {
  const byKey = new Map(sectorRisk.map((r) => [`${r.province_code}::${r.sector}`, r]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-1">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
            <th className="text-left font-normal pl-2">Sector</th>
            {FOCUS.map((p) => (
              <th key={p.code} className="font-normal text-center px-2">
                {p.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SECTORS.map((sector) => (
            <tr key={sector}>
              <td className="text-zinc-200 pl-2 pr-3 py-1 font-medium whitespace-nowrap">
                {sector}
              </td>
              {FOCUS.map((p) => {
                const r = byKey.get(`${p.code}::${sector}`);
                if (!r) {
                  return (
                    <td key={p.code} className="text-center">
                      <span className="inline-block w-full px-2 py-1.5 rounded border border-dashed border-zinc-700 text-zinc-600 text-xs">
                        —
                      </span>
                    </td>
                  );
                }
                return (
                  <td key={p.code} className="text-center">
                    <span
                      title={`${r.provenance} · ${r.data_source ?? ""}`}
                      className={`inline-flex items-center justify-center gap-1 w-full px-2 py-1.5 rounded border font-semibold uppercase text-[11px] ${RISK_BG_CLASS[r.level]}`}
                    >
                      {r.level}
                      <span className="opacity-80 text-[10px]">{TREND_GLYPH[r.trend]}</span>
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
