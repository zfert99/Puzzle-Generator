# /kakuro Route: Plain English Pseudocode

The Kakuro **workbench** route (plan slices V0–V1). A Server Component — routing and layout only.

```text
Render a page shell (title "Kakuro", subtitle "Cross Sums").
For each hand-baked fixture (7×7, then 9×9):
    render a size heading and a static <KakuroBoard> for it.
```

Every fixture is shown, not just one, so the look can be judged at each size — clue text and
cell proportions that work at 7×7 are not guaranteed to work at 9×9.

There is no client boundary at all: the boards are static and the fixtures are static data, so
nothing is interactive and nothing is generated. Because the board renders on the server, the
fixtures' solutions are never sent to the browser.

This is a build surface, not a product page. It exports `robots: { index: false }`, is not in
`sitemap.ts`, and has no hub card or header link — it is reachable only by typing the URL
(`/puzzles/kakuro`). When the board becomes playable (V2) it moves to `/play?variant=kakuro` and
this route is deleted.
