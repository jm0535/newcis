// Page nav. Sits under the status bar so the audience always knows where they are.
import Link from "next/link";
import { LayoutDashboard, CloudSun, Briefcase, Radio } from "lucide-react";

const PAGES = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/climate", label: "ENSO Climate", icon: CloudSun },
  { href: "/sectors", label: "Sectoral Impact", icon: Briefcase },
  { href: "/operations", label: "Operations", icon: Radio },
];

export function PageNav({ active }: { active: string }) {
  return (
    <nav
      aria-label="Primary"
      className="px-6 border-b border-border-subtle flex gap-1 text-xs"
    >
      {PAGES.map((p) => {
        const isActive = active === p.href;
        const Icon = p.icon;
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={isActive ? "page" : undefined}
            className={`px-3 py-2.5 inline-flex items-center gap-1.5 uppercase tracking-[0.08em] border-b-2 transition-colors font-medium ${
              isActive
                ? "text-accent border-accent"
                : "text-text-muted border-transparent hover:text-text-1 hover:border-border-default"
            }`}
          >
            <Icon size={13} />
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
