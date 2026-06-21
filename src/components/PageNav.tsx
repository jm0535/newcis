// Page nav. Sits under the status bar so the audience always knows where they are.
import Link from "next/link";
import { LayoutDashboard, CloudSun, TrendingUp, Briefcase, Radio, Workflow } from "lucide-react";

const PAGES = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/climate", label: "ENSO Climate", icon: CloudSun },
  { href: "/forecast", label: "Forecast", icon: TrendingUp },
  { href: "/sectors", label: "Sectoral Impact", icon: Briefcase },
  { href: "/topology", label: "Risk Network", icon: Workflow },
  { href: "/operations", label: "Operations", icon: Radio },
];

export function PageNav({ active }: { active: string }) {
  return (
    <nav
      aria-label="Primary"
      className="px-4 md:px-6 border-b border-border-subtle flex items-center gap-1 text-xs overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {/* Brand mark = home link. The NEWCIS crest + wordmark mirror the landing
          header, giving every dashboard page a one-click route back to "/". */}
      <Link
        href="/"
        aria-label="NEWCIS home"
        title="Back to home"
        className="mr-2 flex items-center gap-2 shrink-0 text-text-1 hover:text-accent transition-colors"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/newcis-logo-512.png"
          alt=""
          width={22}
          height={22}
          className="h-[22px] w-[22px] rounded-full shrink-0"
        />
        <span className="hidden sm:inline text-sm font-semibold tracking-tight">
          NEWCIS
        </span>
      </Link>
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
