# sample-layout: Plain English Pseudocode

One hand-drawn Kakuro **shape** — `KAKURO_SAMPLE_7X7` — for the looks-only board (plan slice V0).
It has no clues and no solution; it only says which cells are white and which are black.

```text
one string per interior row
    "." = white (fillable) cell
    "#" = black cell
```

## Why it looks the way it does

- **Interior cells only.** The clue gutter along the top and left is added by the renderer
  (plan decision D2), so the array length is the puzzle's named size: 7.
- **Drawn to the real layout rules (D9)** so the picture is a believable board, not a random
  scatter: 180° rotational symmetry, one connected white region, and every white cell sits in
  both an across run and a down run of length 2–7.
- **32 white cells.** The published ceiling for a uniquely-solvable 7×7 is 34
  ([findings, G10](../../../../../Docs/research/kakuro-research-gaps-findings.md)), so this shape
  could carry a real puzzle later.

The symmetry is asserted in `KakuroBoard.test.tsx`. The other rules are not checked here — V1's
`deriveRuns` will validate them properly, and V1's fixtures replace this file.
