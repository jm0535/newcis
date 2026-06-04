"use client";

// Hands-free data refresh for the operating picture. Every `intervalMs` (default
// 2 min — frequent enough to catch a manual ingest or live-event update quickly,
// while the real ingest cadence stays ~6-hourly) it calls router.refresh(),
// which re-runs every server
// component and re-paints all cards with the latest /data state. No reload, no
// flicker — React reconciles only what changed.
//
// Behaviour tuned for an ops-centre big screen left running unattended:
//   - Pauses while the tab is hidden (a backgrounded display shouldn't poll).
//   - Refreshes once immediately when the tab becomes visible again, so a screen
//     that was asleep catches up the moment someone looks at it.
//   - Shows a tiny, non-intrusive "live" dot + "checked HH:MM" so a viewer can
//     trust the picture is current.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const CHECK_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Pacific/Port_Moresby",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function AutoRefresh({ intervalMs = 2 * 60_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  // Keep the latest refresh fn in a ref so the interval closure never goes stale.
  const refreshRef = useRef<() => void>(() => {});

  refreshRef.current = () => {
    startTransition(() => {
      router.refresh();
      setLastChecked(CHECK_FMT.format(new Date()));
    });
  };

  useEffect(() => {
    const id = setInterval(() => {
      // Don't poll a backgrounded tab.
      if (document.visibilityState === "visible") refreshRef.current();
    }, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") refreshRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);

  return (
    <span
      className="flex items-center gap-1.5 text-text-muted"
      title="Dashboard auto-refreshes; data updates as soon as a new ingest lands"
      aria-live="polite"
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          pending ? "bg-status-amber animate-pulse" : "bg-status-green"
        }`}
        aria-hidden
      />
      <span className="hidden md:inline">
        {pending ? "Checking…" : lastChecked ? `Live · ${lastChecked} PGT` : "Live"}
      </span>
    </span>
  );
}
