# NEWCIS Design System

A small, deliberate system. Two layers of tokens, a handful of primitives, sensible motion. Built for a high-contrast operations-centre display, scales down to a phone.

## Token layers

Tokens live in [src/app/globals.css](../src/app/globals.css). Two layers:

1. **Primitive** — raw oklch zinc ramp + status hues. Don't reference these in components.
2. **Semantic** — intent-named (`--surface-1`, `--text-muted`, `--accent`). Components reference only these.

Switching themes (`.dark` ↔ `.light` on `<html>`) rebinds the semantic layer. No component code changes.

### Semantic tokens

| Group | Tokens | Use for |
|---|---|---|
| Surface | `--surface-0` … `--surface-3`, `--surface-overlay` | Page bg, cards, raised cards, popovers (overlay is translucent + backdrop-blur) |
| Border | `--border-subtle`, `--border-default`, `--border-strong` | Hairlines, default borders, hover borders |
| Text | `--text-1`, `--text-2`, `--text-muted`, `--text-disabled` | Primary, secondary, labels/meta, disabled |
| Accent | `--accent`, `--accent-hover`, `--accent-muted` | Primary CTAs, active nav, LIVE badge |
| Status | `--status-green/amber/red/black` | Traffic-light bands; never hardcode hex |
| Space | `--space-1` (4px) … `--space-12` (48px) | Prefer Tailwind `p-*` / `gap-*` |
| Radius | `--radius-sm` (4px) … `--radius-xl` (16px), `--radius-full` | Rounded corners |
| Elevation | `--elevation-1/2/3` | Shadow ramp (use sparingly — dark UI) |
| Type | `--text-2xs` … `--text-3xl` | Mirrored by Tailwind text-* utilities |
| Motion | `--duration-fast` (120ms) / `--base` (200ms) / `--slow` (320ms), `--ease-out`, `--ease-in-out` | Transition timing |

Tailwind reads these via `@theme inline` — `bg-surface-1`, `text-text-muted`, `border-border-default`, `text-status-red`, etc.

### Numeric data convention

Add `data-numeric` to anything that renders a value or code. CSS routes those nodes to JetBrains Mono with `font-variant-numeric: tabular-nums` so digits align in columns.

## UI primitives

In [src/components/ui/](../src/components/ui/). Use these instead of ad-hoc divs.

| Primitive | Props | When |
|---|---|---|
| `Card` | `variant: default \| muted \| elevated`, `padding: none \| sm \| md \| lg` | Any panel. `elevated` for "current" / hero state |
| `MetricTile` | `label`, `value`, `hint?`, `tone?: neutral \| green \| amber \| red \| black`, `icon?` | KPI tile with semantic tone tint |
| `StatusPill` | `status: green \| amber \| red \| black \| neutral`, `size: sm \| md`, `pulse?` | Traffic-light readouts |
| `Badge` | `variant: default \| accent \| outline \| subtle` | Labels, tags |
| `Button` | `variant: primary \| secondary \| ghost \| destructive`, `size`, `icon?` | All actions |
| `SectionHeader` | `eyebrow?`, `title`, `description?`, `action?` | Top of page sections |
| `EmptyState` | `icon?`, `title`, `description?`, `action?` | When a list/panel has no data |

### Rules of thumb

- Don't put zinc-* utilities in new code — use semantic tokens or primitives.
- Status colour is intent, not decoration. If it's not a real alert level, use `--text-muted`.
- One `SectionHeader` per major section; nest `Card`s for sub-groupings.
- Icons: lucide-react, `size={12}` for inline, `size={14}` for headers.

## Typography

- **Inter** (variable) — UI, prose. Loaded via `next/font` as `--font-sans`.
- **JetBrains Mono** (variable) — numbers, codes, timestamps. Applied via `[data-numeric]` selector.
- Tracking: `tracking-[0.08em]` on uppercase eyebrows / labels.

## Theming

`.dark` is the default class on `<html>`. `ThemeToggle` flips to `.light`, persists in `localStorage`. A no-flash inline script in `layout.tsx` applies the saved class before paint.

## Motion

- All transitions respect `prefers-reduced-motion`.
- Gauge marker animates in via framer-motion on the climate page (`IndicatorGauge`).
- StatusPill `pulse` adds an `animate-pulse` dot — use for non-GREEN national alerts only.
- Defaults: `--duration-base` (200ms), `--ease-out` for entrances, `--ease-in-out` for state changes.

## Accessibility

- `*:focus-visible` outline uses `--accent` with 2px offset (globals.css).
- Nav: `aria-current="page"` on active route.
- Basemap switcher: `role="radiogroup"` + `aria-checked` per option.
- Gauge marker carries `aria-label` with axis percentage.
- All icon-only buttons have `aria-label`.
- Source-health dots in StatusBar have per-source `aria-label`.

## Adding a new primitive

1. Reference semantic tokens only (never zinc-* directly, never hex).
2. Forward `className` and merge it last so callers can override.
3. Export from `src/components/ui/index.ts`.
4. Add a row to the primitives table above.
