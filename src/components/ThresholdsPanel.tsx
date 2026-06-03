// Threshold panel — exposes the band edges driving every traffic light.
// Editable in data/risk_thresholds.json; shown here so the technical
// audience can see exactly why "Enga is red" without reading code.
import type { RiskThreshold } from "@/lib/types";
import { ALERT_COLOUR } from "@/lib/ui";

export function ThresholdsPanel({ thresholds }: { thresholds: RiskThreshold[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="text-left pl-2 py-2 font-normal">Metric</th>
            <th className="text-left py-2 font-normal">Unit</th>
            <th className="text-right py-2 font-normal" style={{ color: ALERT_COLOUR.AMBER }}>
              AMBER ≤
            </th>
            <th className="text-right py-2 font-normal" style={{ color: ALERT_COLOUR.RED }}>
              RED ≤
            </th>
            <th className="text-right py-2 font-normal" style={{ color: ALERT_COLOUR.BLACK }}>
              BLACK ≤
            </th>
            <th className="text-left pl-4 py-2 font-normal">Direction</th>
          </tr>
        </thead>
        <tbody>
          {thresholds.map((t) => (
            <tr key={t.metric} className="border-t border-zinc-900">
              <td className="pl-2 py-1.5 text-zinc-200 font-medium">{t.metric}</td>
              <td className="py-1.5 text-zinc-500 text-xs">{t.unit ?? "—"}</td>
              <td className="py-1.5 text-right tabular-nums">{t.green_max}</td>
              <td className="py-1.5 text-right tabular-nums">{t.amber_max}</td>
              <td className="py-1.5 text-right tabular-nums">{t.red_max}</td>
              <td className="pl-4 py-1.5 text-xs text-zinc-400">
                {t.inverted ? "lower = worse" : "|value| compared"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] text-zinc-500">
        Bands live in <code className="text-zinc-300">data/risk_thresholds.json</code> — retune without code changes.
      </p>
    </div>
  );
}
