# Site Backdrop (`Backdrop.tsx`)

The eye-candy layer: three slow-drifting **aurora blobs** (butterscotch, grape, mint) plus a
scatter of huge, near-invisible **puzzle glyphs** (digits, ∑, ⌗), fixed behind every page.
The per-page dot pattern is a transparent SVG, so the blobs glow through the dots — the
balance point between "clean" and "visually interesting" the design asked for.

## Why it's built this way

- **Theme-aware for free** — colors are `color-mix` over token vars; light gets a warm pastel
  wash, dark gets deep glows from the same rules (plus small per-theme intensity nudges).
- **Cheap** — transform-only animations (GPU-composited); pre-soft radial gradients instead of
  `filter: blur` (expensive at 70vmax); `pointer-events: none`; `aria-hidden` (decorative).
  INP untouched — nothing here runs on interaction. The blobs and glyphs also carry
  `will-change: transform` (July 2026) — without it, some mobile browsers were recompositing
  the whole fixed `.site-backdrop` layer on every scroll frame instead of treating these
  always-animating children as independent compositor layers, causing visible scroll
  stutter (reported on the hub; this backdrop mounts once in the root layout and renders
  behind every page, so the fix applies everywhere). A permanent `will-change` hint is
  deliberate here, not the usual toggle-on/toggle-off pattern
  (`Docs/research/nextjs-performance.md`'s "sparingly... removed after" guidance) — these
  elements animate continuously for their entire mounted lifetime and never return to a
  non-animating state, so there's no "after" to remove it at.
- **Motion-safe** — `prefers-reduced-motion` freezes all drift (globals.css).
- **Deterministic** — glyph positions are a fixed table, not RNG: this is a Server Component
  and must render identically on server and client (AGENTS.md §1 hydration rule).

Styles live in `globals.css` under "Site backdrop"; the component is mounted once in the root
layout, behind `AppHeader` and content (`z-index: -1`).
