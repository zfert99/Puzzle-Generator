# /kakuro Route: Plain English Pseudocode

The Kakuro **workbench** route (plan slice V0). A Server Component — routing and layout only.

```text
Render a page shell (title "Kakuro", subtitle "Cross Sums").
Render <KakuroBoard> with the hand-drawn 7×7 sample layout.
```

There is no client boundary at all: the board is looks-only and the layout is static data, so
nothing is interactive and nothing is generated.

This is a build surface, not a product page. It exports `robots: { index: false }`, is not in
`sitemap.ts`, and has no hub card or header link — it is reachable only by typing the URL
(`/puzzles/kakuro`). When the board becomes playable (V2) it moves to `/play?variant=kakuro` and
this route is deleted.
