"use client";

// Live national clock — ticks every second in Papua New Guinea time (UTC+10).
// The status bar otherwise shows only the frozen last-ingest timestamp, which
// makes the app feel "behind"; a real ticking clock in PNG time fixes that.
// Renders nothing until mounted to avoid a server/client hydration mismatch
// (the server has no notion of "now in PNG").
import { useEffect, useState } from "react";

const PNG_CLOCK_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Pacific/Port_Moresby",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function LiveClock() {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setNow(PNG_CLOCK_FMT.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) return null;

  return (
    <span data-numeric className="text-text-2 tabular-nums">
      {now} <span className="text-text-muted">PGT</span>
    </span>
  );
}
