"use client";

// Single climate indicator card with a horizontal band gauge. The bar shows
// where the current value sits across GREEN/AMBER/RED/BLACK bands — the
// executive question "are we in trouble yet?" reduces to one glance.
import { motion } from "framer-motion";
import type { AlertLevel, Indicator, RiskThreshold } from "@/lib/types";
import { ALERT_COLOUR, TREND_GLYPH } from "@/lib/ui";
import { ProvenanceBadge } from "./Provenance";
import { Card, StatusPill } from "./ui";
import { classifyIndicator } from "@/lib/risk-engine";

const ALERT_STATUS = {
  GREEN: "green",
  AMBER: "amber",
  RED: "red",
  BLACK: "black",
} as const;

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
    <Card padding="md" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.08em] text-text-muted font-semibold">
            {indicator.key}
          </div>
          <div className="text-sm text-text-1 font-medium truncate mt-0.5">
            {indicator.label}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ProvenanceBadge value={indicator.provenance} />
          <StatusPill status={ALERT_STATUS[level]} size="sm">
            {level}
          </StatusPill>
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-text-1" data-numeric>
          {indicator.value === null ? "—" : indicator.value}
        </span>
        <span className="text-xs text-text-muted">{indicator.unit}</span>
        <span className="ml-auto text-base text-text-2" data-numeric>
          {TREND_GLYPH[indicator.trend]}
        </span>
      </div>

      <div className="relative h-2 rounded-full overflow-hidden bg-surface-3">
        {stops.length > 0 && (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to right, ${stops
                .map((s, i) => `${s.c} ${i === 0 ? 0 : stops[i - 1].end}%, ${s.c} ${s.end}%`)
                .join(", ")})`,
            }}
          />
        )}
        {valuePct !== null && (
          <motion.span
            className="absolute top-1/2 w-1 h-4 bg-text-1 rounded-sm shadow-[0_0_0_1px_var(--surface-0)]"
            style={{ y: "-50%" }}
            initial={{ left: "calc(0% - 2px)", opacity: 0 }}
            animate={{ left: `calc(${valuePct}% - 2px)`, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            aria-label={`Current value at ${valuePct.toFixed(0)}% of axis`}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-text-muted -mt-1" data-numeric>
        <span>{range[0].toFixed(1)}</span>
        <span>{range[1].toFixed(1)}</span>
      </div>

      <div className="text-[10px] text-text-muted flex justify-between gap-2 pt-1 border-t border-border-subtle">
        <span className="truncate">{indicator.source}</span>
        <span data-numeric>{indicator.observed_at}</span>
      </div>
    </Card>
  );
}
