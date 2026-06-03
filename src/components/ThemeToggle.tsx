"use client";

import { useEffect, useState } from "react";

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
      className="px-2 py-1 text-[10px] uppercase tracking-wider border border-zinc-800 rounded text-zinc-400 hover:text-zinc-100 hover:border-zinc-600 transition-colors"
    >
      {theme === "dark" ? "☀ Light" : "☾ Dark"}
    </button>
  );
}
