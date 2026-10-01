# KakuroDevBadge (`KakuroDevBadge.tsx`)

A one-line, development-only readout under a Kakuro board: "solver: unique ✓ · 13 nodes" (or
"NOT unique — N solutions found" / "node budget exhausted").

## Why it exists

The Kakuro plan builds the engine *under a page that already exists*, and asks each engine
slice for something visible on the board (learning L5). For E1 — the exact solver — that is
this badge: proof that a real solver has looked at the puzzle, with its cost. Later slices read
the node count as a rough difficulty signal while the classifier is built.

## What it does

```text
read the store's runs and grid size
count the puzzle's solutions (limit 2) — memoized on runs/size, so once per game
render the verdict with the search-node count
```

Nodes, not milliseconds: the node count is a pure function of the puzzle, so it can be derived
during render; a wall-clock timing is not (`react-hooks/purity` rejects `performance.now()` in
render — CI caught the first draft) and belongs in the engine benchmarks.

It is rendered by `PlayExperience` only when `NODE_ENV === 'development'` and the board's
variant is Kakuro, so production never sees it and no other type pays for it.
