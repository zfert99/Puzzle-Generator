# Route Template (`template.tsx`)

The per-navigation route transition (design system §4).

## Why a `template`, not the layout

**Why:** A `template` re-mounts on every route change (a `layout` persists), so giving its
wrapper an enter animation gives each page a gentle **fade + 8px slide** on navigation. The
wrapper is `flex-1 flex flex-col` so it transparently passes the body's flex column through to
each page's `flex-1` main (no layout break).

## Why CSS, not the `motion` library (October 2026)

**Why:** The template used to be a client component rendering a `motion.div`. That cost two
things on every route: the `motion` runtime (~39 KB gzipped) was in the bundle of pages that
never animate anything else (hub, leaderboard, sign-in, print packs), and the server-rendered
HTML carried `opacity:0; transform:translateY(8px)` as an inline style — so the whole page was
invisible until the framework had downloaded, hydrated and run the animation. The Largest
Contentful Paint element could never paint before hydration, the worst case for LCP on a slow
connection. A CSS keyframe plays at first paint with no JavaScript, and reduced motion is
honoured by the `[data-motion="reduce"]` attribute the pre-paint script sets before first
paint — something the client-side hook (whose server snapshot was always "not reduced") could
not do.

```text
render -> <div class="flex-1 flex flex-col page-enter">{children}</div>
CSS    -> .page-enter { animation: page-enter 150ms ease-out both }   (opacity 0→1, y 8px→0)
          [data-motion="reduce"] .page-enter { animation: none }
          @media (prefers-reduced-motion: reduce) → also none unless data-motion="full"
```

The library is no longer a dependency; the solved stamp (`features/juice/SolvedStamp.tsx`)
moved to CSS keyframes in the same change.
