// Lightweight page nav. Phases 5–8 each get one route; this sits under the
// status bar so the audience always knows where they are.
import Link from "next/link";

const PAGES = [
  { href: "/", label: "Overview" },
  { href: "/climate", label: "ENSO Climate" },
  { href: "/sectors", label: "Sectoral Impact" },
  { href: "/operations", label: "Operations" },
];

export function PageNav({ active }: { active: string }) {
  return (
    <nav className="px-6 border-b border-zinc-900 flex gap-1 text-xs">
      {PAGES.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          className={`px-3 py-2 uppercase tracking-wider border-b-2 transition-colors ${
            active === p.href
              ? "text-emerald-300 border-emerald-400"
              : "text-zinc-400 border-transparent hover:text-zinc-200"
          }`}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
