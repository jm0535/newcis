// The one sentence the Prime Minister reads first. Synthesises the national
// status into plain English — "what's happening, how bad, what to do" — so a
// non-technical leader gets the bottom line before scanning any tile or matrix.
import type { NationalStatus } from "@/lib/types";
import { ALERT_ACTION, bottomLineSentence } from "@/lib/national-language";
import { StatusPill } from "./ui";
import { AlertTriangle } from "lucide-react";

const ALERT_STATUS = { GREEN: "green", AMBER: "amber", RED: "red", BLACK: "black" } as const;

export function ExecutiveHeadline({ national }: { national: NationalStatus | null }) {
  if (!national) return null;

  const level = national.alert_level;

  const sentence = bottomLineSentence(national);

  return (
    <div className="rounded-lg border border-border-default bg-surface-1 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-2 shrink-0">
        <AlertTriangle size={16} className="text-status-red" />
        <span className="text-[10px] uppercase tracking-[0.12em] text-text-muted font-semibold">
          Bottom line
        </span>
        <StatusPill status={ALERT_STATUS[level]} size="sm" pulse={level === "RED" || level === "BLACK"}>
          {level}
        </StatusPill>
      </div>
      <p className="text-sm text-text-1 leading-relaxed">
        {sentence}{" "}
        <span className="text-text-2 font-medium">{ALERT_ACTION[level]}</span>
      </p>
    </div>
  );
}
