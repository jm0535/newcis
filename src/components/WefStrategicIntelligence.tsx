/**
 * WEF Strategic Intelligence — placement B: a standing section below the topology
 * graph. Tiles are seeded from WEF's openly published outputs (DEMO), each
 * linking out to a real public WEF page. This brings genuine WEF risk framing
 * onto NEWCIS without scraping login-gated content or copying WEF body text.
 */
import { ExternalLink } from "lucide-react";
import type { WefInsight } from "@/lib/wef";
import { Card, SectionHeader, Badge } from "./ui";
import { WefCover } from "./WefCover";

export function WefStrategicIntelligence({ insights }: { insights: WefInsight[] }) {
  if (insights.length === 0) return null;
  const [headline, ...rest] = insights;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SectionHeader
          title="WEF Strategic Intelligence"
          description="World Economic Forum risk framing, mapped to NEWCIS sectors."
        />
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <Badge>DEMO</Badge>
          <span>Source: World Economic Forum</span>
        </div>
      </div>

      <a
        href={headline.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block group"
      >
        <Card className="space-y-2 transition-colors hover:border-border-strong">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-text-muted">
            <span>{headline.source}</span>
            <span data-numeric>{headline.published}</span>
          </div>
          <h3 className="text-base font-semibold group-hover:text-accent transition-colors">
            {headline.title}
          </h3>
          <p className="text-sm text-text-muted leading-relaxed">{headline.summary}</p>
          <WefCover insight={headline} className="h-28" />
          <span className="inline-flex items-center gap-1 text-xs text-accent">
            Read on weforum.org <ExternalLink size={12} />
          </span>
        </Card>
      </a>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((i) => (
          <a
            key={i.id}
            href={i.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <Card className="flex h-full flex-col space-y-2 transition-colors hover:border-border-strong">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-text-muted">
                <span>{i.source}</span>
                <span data-numeric>{i.published}</span>
              </div>
              <h4 className="text-sm font-semibold group-hover:text-accent transition-colors">
                {i.title}
              </h4>
              <p className="text-xs text-text-muted leading-relaxed">{i.summary}</p>
              <WefCover insight={i} className="mt-auto h-20" />
              <span className="inline-flex items-center gap-1 text-[11px] text-accent">
                Read on weforum.org <ExternalLink size={11} />
              </span>
            </Card>
          </a>
        ))}
      </div>
    </section>
  );
}
