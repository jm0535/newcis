// Single climate indicator card with a horizontal band gauge. The bar shows
// where the current value sits across GREEN/AMBER/RED/BLACK bands — the
// executive question "are we in trouble yet?" reduces to one glance.
import type { AlertLevel, Indicator, RiskThreshold } from "@/lib/types";
import { ALERT_BG_CLASS, ALERT_COLOUR, TREND_GLYPH } from "@/lib/ui";
import { ProvenanceBadge } from "./Provenance";
import { classifyIndicator } from "@/lib/risk-engine";

// Pick a sensible axis range for the band visual. The widest band edge gives us
// the upper bound; for inverted metrics the axis runs negative-to-zero.
function axisRange(t: RiskThreshold): [number, number] {
  const widest = Math.max(Math.abs(t.green_max), Math.abs(t.amber_max), Math.abs(t.red_max));
  const padded = widest * 1.3;
  return t.inverted ? [-padded, 0] : [-padded, padded];
}

function pct(value: number, [min, max]: [number, number]): number {
  const clamped = Math.max(min, Math.min(max, value));
  return ((clamped - min) / (max - min)) * 100;
}

export function IndicatorGauge({
  indicator,
  threshold,
}: {
  indicator: Indicator;
  threshold: RiskThreshold | undefined;
}) {
  const level: AlertLevel = classifyIndicator(indicator.value, threshold);
  const range = threshold ? axisRange(threshold) : ([-2, 2] as [number, number]);
  const valuePct = indicator.value === null ? null : pct(indicator.value, range);

  // Compute band stops as percentages along the axis. Same formula as classify:
  // non-inverted uses absolute value; inverted bands are negative-side stops.
  const stops = threshold
    ? threshold.inverted
      ? [
          { c: ALERT_COLOUR.BLACK, end: pct(threshold.red_max, range) },
          { c: ALERT_COLOUR.RED, end: pct(threshold.amber_max, range) },
          { c: ALERT_COLOUR.AMBER, end: pct(threshold.green_max, range) },
          { c: ALERT_COLOUR.GREEN, end: 100 },
        ]
      : (() => {
          const midPct = pct(0, range);
          const a = pct(threshold.green_max, range);
          const b = pct(threshold.amber_max, range);
          const c = pct(threshold.red_max, range);
          const mirror = (p: number) => 2 * midPct - p;
          return [
            { c: ALERT_COLOUR.BLACK, end: mirror(c) },
            { c: ALERT_COLOUR.RED, end: mirror(b) },
            { c: ALERT_COLOUR.AMBER, end: mirror(a) },
            { c: ALERT_COLOUR.GREEN, end: a },
            { c: ALERT_COLOUR.AMBER, end: b },
            { c: ALERT_COLOUR.RED, end: c },
            { c: ALERT_COLOUR.BLACK, end: 100 },
          ];
        })()
    : [];

  return (
    <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">{indicator.key}</div>
          <div className="text-sm text-zinc-200 font-medium truncate">{indicator.label}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ProvenanceBadge value={indicator.provenance} />
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${ALERT_BG_CLASS[level]}`}
          >
            {level}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums">
          {indicator.value === null ? "—" : indicator.value}
        </span>
        <span className="text-xs text-zinc-500">{indicator.unit}</span>
        <span className="ml-auto text-xs text-zinc-400">{TREND_GLYPH[indicator.trend]}</span>
      </div>

      <div className="mt-3 relative h-2 rounded-full overflow-hidden bg-zinc-800">
        {stops.length > 0 ? (
          <div
            className="absolute inset-0 flex"
            style={{
              background: `linear-gradient(to right, ${stops
                .map((s, i) => `${s.c} ${i === 0 ? 0 : stops[i - 1].end}%, ${s.c} ${s.end}%`)
                .join(", ")})`,
            }}
          />
        ) : null}
        {valuePct !== null && (
          <span
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-white shadow"
            style={{ left: `calc(${valuePct}% - 1px)` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-zinc-500 tabular-nums">
        <span>{range[0].toFixed(1)}</span>
        <span>{range[1].toFixed(1)}</span>
      </div>

      <div className="mt-2 text-[10px] text-zinc-500 flex justify-between gap-2">
        <span className="truncate">{indicator.source}</span>
        <span className="font-mono">{indicator.observed_at}</span>
      </div>
    </div>
  );
}
