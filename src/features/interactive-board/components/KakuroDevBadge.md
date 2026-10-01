# KakuroDevBadge (`KakuroDevBadge.tsx`)

A one-line, development-only readout under a Kakuro board: "solver: unique ✓ · 13 nodes ·
2.40 ms" (or "NOT unique — N solutions found" / "node budget exhausted").

## Why it exists

The Kakuro plan builds the engine *under a page that already exists*, and asks each engine
slice for something visible on the board (learning L5). For E1 — the exact solver — that is
this badge: proof that a real solver has looked at the puzzle, with its cost. Later slices read
the node count as a rough difficulty signal while the classifier is built.

## What it does

```text
read the store's runs and grid size
count the puzzle's solutions (limit 2) and time it — memoized on runs/size, so once per game
render the verdict
```

It is rendered by `PlayExperience` only when `NODE_ENV === 'development'` and the board's
variant is Kakuro, so production never sees it and no other type pays for it.
