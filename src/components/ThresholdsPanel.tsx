// Threshold panel — exposes the band edges driving every traffic light.
// Editable in data/risk_thresholds.json; shown here so the technical
// audience can see exactly why "Enga is red" without reading code.
import type { RiskThreshold } from "@/lib/types";

export function ThresholdsPanel({ thresholds }: { thresholds: RiskThreshold[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-[10px] uppercase tracking-[0.08em] text-text-muted">
          <tr>
            <th className="text-left pl-2 py-2 font-medium">Metric</th>
            <th className="text-left py-2 font-medium">Unit</th>
            <th className="text-right py-2 font-medium text-status-amber">AMBER ≤</th>
            <th className="text-right py-2 font-medium text-status-red">RED ≤</th>
            <th className="text-right py-2 font-medium text-text-2">BLACK ≤</th>
            <th className="text-left pl-4 py-2 font-medium">Direction</th>
          </tr>
        </thead>
        <tbody>
          {thresholds.map((t) => (
            <tr key={t.metric} className="border-t border-border-subtle">
              <td className="pl-2 py-2 text-text-1 font-medium" data-numeric>
                {t.metric}
              </td>
              <td className="py-2 text-text-muted text-xs">{t.unit ?? "—"}</td>
              <td className="py-2 text-right text-text-2" data-numeric>
                {t.green_max}
              </td>
              <td className="py-2 text-right text-text-2" data-numeric>
                {t.amber_max}
              </td>
              <td className="py-2 text-right text-text-2" data-numeric>
                {t.red_max}
              </td>
              <td className="pl-4 py-2 text-xs text-text-muted">
                {t.inverted ? "lower = worse" : "|value| compared"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] text-text-muted">
        Bands live in{" "}
        <code className="text-text-2 bg-surface-2 px-1 py-0.5 rounded" data-numeric>
          data/risk_thresholds.json
        </code>{" "}
        — retune without code changes.
      </p>
    </div>
  );
}
