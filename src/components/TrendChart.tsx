"use client";

// 12-month trend line for one indicator key, with threshold bands drawn as
// horizontal reference lines so the audience sees when we crossed into AMBER/RED.
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistoricalReading, RiskThreshold } from "@/lib/types";
import { ALERT_COLOUR } from "@/lib/ui";

export function TrendChart({
  indicatorKey,
  history,
  threshold,
  height = 160,
}: {
  indicatorKey: string;
  history: HistoricalReading[];
  threshold: RiskThreshold | undefined;
  height?: number;
}) {
  const series = history
    .filter((h) => h.key === indicatorKey)
    .sort((a, b) => a.observed_at.localeCompare(b.observed_at))
    .map((h) => ({ date: h.observed_at.slice(0, 10), value: h.value }));

  if (series.length === 0) {
    return (
      <div
        className="text-xs text-zinc-500 border border-dashed border-zinc-800 rounded flex items-center justify-center"
        style={{ height }}
      >
        No history yet — accumulating after each ingest.
      </div>
    );
  }

  const refs: { y: number; c: string; label: string }[] = threshold
    ? threshold.inverted
      ? [
          { y: threshold.green_max, c: ALERT_COLOUR.AMBER, label: "AMBER" },
          { y: threshold.amber_max, c: ALERT_COLOUR.RED, label: "RED" },
          { y: threshold.red_max, c: ALERT_COLOUR.BLACK, label: "BLACK" },
        ]
      : [
          { y: threshold.green_max, c: ALERT_COLOUR.AMBER, label: "+AMBER" },
          { y: -threshold.green_max, c: ALERT_COLOUR.AMBER, label: "−AMBER" },
          { y: threshold.amber_max, c: ALERT_COLOUR.RED, label: "+RED" },
          { y: -threshold.amber_max, c: ALERT_COLOUR.RED, label: "−RED" },
        ]
    : [];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 10 }} minTickGap={24} />
        <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={32} />
        <Tooltip
          contentStyle={{
            background: "#09090b",
            border: "1px solid #27272a",
            fontSize: 12,
            color: "#f4f4f5",
          }}
          labelStyle={{ color: "#a1a1aa" }}
        />
        {refs.map((r, i) => (
          <ReferenceLine
            key={i}
            y={r.y}
            stroke={r.c}
            strokeDasharray="4 2"
            strokeOpacity={0.7}
          />
        ))}
        <Line
          type="monotone"
          dataKey="value"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 2, fill: "#10b981" }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
