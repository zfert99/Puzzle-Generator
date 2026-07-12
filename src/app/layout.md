# Root Layout (`layout.tsx`)

The foundational wrapper for every page.

## Fonts (why these three, self-hosted)

**Why:** The Biscuit Lab type system pairs three roles deliberately (not Inter-everywhere).
Each is loaded via `next/font/google` — self-hosted, so **no layout shift and no external
request** — and exposed as a CSS var that `@theme` maps to a Tailwind font family:

```text
Fredoka     -> --font-fredoka     -> font-display   (chunky arcade display: logo, headlines, wins)
Manrope     -> --font-manrope     -> font-sans      (body/UI default)
Space Mono  -> --font-space-mono  -> font-mono      (grid digits, timers, stats)
```

Space Mono is not a variable font, so its weights (`400`, `700`) are pinned.

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
