# Web App Manifest (`manifest.ts`)

Makes the app installable (a11y audit G9).

## Why a route file, and why relative icon paths

**Why:** Next's `app/manifest.ts` convention serves the manifest at
`/puzzles/manifest.webmanifest` (the basePath is applied) and links it from every page's
metadata, so there is nothing to wire by hand. The icon `src` values are **relative**
(`icons/icon-192.png`) because a manifest's URLs resolve against the manifest's own URL — an
absolute `/icons/…` would resolve outside the `/puzzles` zone, the same class of bug as the old
`bg-pattern` URL. `start_url` and `scope` are the zone root.

**Why no service worker:** Chrome removed it as an install requirement in 2024, and an offline
shell for an app whose puzzles come from the server (and whose daily is a shared board) is a
feature decision, not a checkbox — recorded as still open in the a11y audit.

The icons (`public/icons/*.png`, `app/apple-icon.png`) are generated from an SVG — grape rounded
square, cream 3×3 grid, one butterscotch cell — with a 20 % safe-zone padding on the maskable one
so a round or squircle mask never clips the grid.

```text
name / short_name   Puzzle Lab
start_url / scope   /puzzles
display             standalone
colors              paper #FBF3E3 background · grape #5A3E96 theme
icons               192, 512, 512 maskable (relative paths)
```
