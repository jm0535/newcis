"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "dark" | "light";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = (localStorage.getItem("newcis-theme") as Theme | null) ?? "dark";
    setTheme(stored);
  }, []);

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
