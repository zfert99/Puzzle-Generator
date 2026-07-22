# Root Layout (`layout.tsx`)

The foundational wrapper for every page.

## Fonts (why these three, self-hosted)

**Why:** The Biscuit Lab type system pairs three roles deliberately (not Inter-everywhere).
Each is loaded via `next/font/google` — self-hosted, so **no layout shift and no external
request** — and exposed as a CSS var that `@theme` maps to a Tailwind font family:

```text
Fredoka          -> font-display   (chunky arcade display: logo, headlines, wins)
Manrope          -> font-sans      (body/UI default)
Space Mono       -> font-mono      (grid digits, timers, stats)
Permanent Marker -> font-marker    (chaos §8 marginalia — DECORATIVE only)
Caveat           -> font-caveat    (chaos §8 cursive notes — DECORATIVE only)
```

Space Mono + Permanent Marker are not variable, so their weights are pinned. The two marker
fonts are decorative only (never body copy). The layout also renders `<WobbleDefs/>` once —
the SVG filter for the hand-inked wobble (chaos §8).

**Why `preload: false` on the two marker fonts (July 2026):** `next/font` preloads every
font declared at the root on every route by default, but the decorative marker/cursive
fonts aren't guaranteed to render above the fold on every page — on `/daily` this tripped
Firefox's "preloaded but not used within a few seconds" console warning. Disabling preload
for those two only (Fredoka/Manrope/Space Mono still preload — they're used near-universally
on first paint) drops the noise without touching the self-hosted, no-layout-shift loading
this section already covers.

## Pre-paint theme script (why it must run first)

**Why:** The theme is a `data-theme` attribute on `<html>`. If it were set after React
mounts, the page would flash the wrong theme and risk a hydration mismatch. So an inline
`<script>` (the first thing in `<body>`) runs **before paint**: it reads the saved choice
from `localStorage`, else the system preference, and sets `data-theme` immediately. The
string lives in `@/features/theme/theme` (`THEME_PRE_PAINT_SCRIPT`).

```text
<html class="{font vars} antialiased">
  <body>
    <script> apply data-theme before paint </script>
    <AppHeader/>          # global grape nav bar (5.2) — nav, theme toggle, account
    {children}            # each page renders a flex-1 main below the header
```
