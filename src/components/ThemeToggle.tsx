"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "dark" | "light";

// Subscribe to the <html> class the no-flash script (layout.tsx) and `toggle`
// below mutate. useSyncExternalStore gives a DETERMINISTIC server snapshot
// ("dark") that matches the client's hydration snapshot, so there is no
// hydration mismatch and no setState-in-effect. After hydration the client
// snapshot reads the real applied class; the store notifies on every toggle.
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function getClientTheme(): Theme {
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function ThemeToggle() {
  // Server snapshot is fixed "dark" → first client render matches → no mismatch.
  const theme = useSyncExternalStore<Theme>(subscribe, getClientTheme, () => "dark");

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    localStorage.setItem("newcis-theme", next);
    document.documentElement.classList.toggle("light", next === "light");
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-[0.08em] border border-border-default rounded text-text-muted hover:text-text-1 hover:border-border-strong transition-colors"
    >
      {theme === "dark" ? <Sun size={12} /> : <Moon size={12} />}
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
