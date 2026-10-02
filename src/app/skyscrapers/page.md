# /skyscrapers Route: Plain English Pseudocode

The Skyscrapers **workbench** route (plan slices V0–V1). A Server Component — routing and layout
only.

```text
Render a page shell (title "Skyscrapers", subtitle "Towers").
For each baked fixture (5×5 mini, 6×6 standard, 7×7 large — decision D4, planned at the
research recommendation while E3 measures) — render a section labelled with the size, its
role and "k of 4N clues", holding a static <SkyscrapersBoard puzzle={fixture}>, wrapping onto
new rows on narrow screens.
```

There is no client boundary at all: the boards are looks-only and the fixtures are static data,
so nothing is interactive and nothing is generated. Showing the three sizes side by side is the
point of the slice — the size question is judged on screen, not in a table.

This is a build surface, not a product page. It exports `robots: { index: false }`, is not in
`sitemap.ts`, and has no hub card or header link — it is reachable only by typing the URL
(`/puzzles/skyscrapers`). When the board becomes playable (V2) it moves to
`/play?variant=skyscrapers` and this route is deleted.
