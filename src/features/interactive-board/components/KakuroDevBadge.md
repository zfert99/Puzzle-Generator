# KakuroDevBadge (`KakuroDevBadge.tsx`)

A three-line, development-only readout under a Kakuro board:

```text
exact: unique ✓ · 8 nodes
ladder: hard (tier 3) · score 102.9 · comboRestriction×29 nakedSingle×30 … sumBounds×13
metrics: 32 cells · fixed 7 · implied 8 · rating 3.41 · ACRL 3.75 · magic runs 7
```

(or "NOT unique — N solutions found" / "node budget exhausted" on the first line, and
"beyond tier 5 (no chain within the bound)" on the second for a puzzle the ladder cannot finish).

## Why it exists

The Kakuro plan builds the engine *under a page that already exists*, and asks each engine
slice for something visible on the board (learning L5). For E1 — the exact solver — that is
this badge: proof that a real solver has looked at the puzzle, with its cost. Later slices read
the node count as a rough difficulty signal while the classifier is built.

## What it does

```text
read the store's runs and grid size
count the puzzle's solutions (limit 2)                — the exact solver
classify (with metrics: true), score the puzzle      — the logical solver (E2a); the
                                                        metrics are opt-in because they cost
                                                        two extra solves
all memoized on runs/size, so once per game; render the three lines
```

Nodes, not milliseconds: the node count is a pure function of the puzzle, so it can be derived
during render; a wall-clock timing is not (`react-hooks/purity` rejects `performance.now()` in
render — CI caught the first draft) and belongs in the engine benchmarks.

It is rendered by `PlayExperience` only when `NODE_ENV === 'development'` and the board's
variant is Kakuro, so production never sees it and no other type pays for it.
