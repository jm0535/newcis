"use client";

import { useState } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "dark" | "light";

// Read the theme the no-flash inline script (layout.tsx) already applied to
// <html> before paint, so first render matches the DOM with no setState-in-effect
// cascade. SSR has no document → default "dark"; the script reconciles on hydrate.
function initialTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
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
