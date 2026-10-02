# SkyscrapersDevBadge: Plain English Pseudocode

A **development-only** readout under a Skyscrapers board (plan slice E1 in
[skyscrapers-implementation-plan.md](../../../../Docs/skyscrapers-implementation-plan.md)): what
the exact solver says about the puzzle on the board — unique or not, and at what search cost —
plus how many of the 4N clues are present. The plan asks for it as the visible proof that a real
solver sits behind the Hint button; E2 adds the classifier's grade and technique histogram, as
`KakuroDevBadge` shows for Kakuro.

```text
read edgeClues and the size from the store (useShallow — two fields)
no clues → "exact: no clues"
exact = countSkyscrapersSolutions({ gridSize, clues })     (memoised on clues + size)
line  = budget exhausted → "uniqueness: node budget exhausted"
        solutions ≠ 1     → "NOT unique — k solutions found"
        otherwise         → "unique ✓ · n nodes"
      + " · k of 4N clues"
```

Nodes, not milliseconds: a count is a pure function of the puzzle and can be derived in render,
a wall-clock timing is not (`react-hooks/purity`, the Kakuro E1 lesson) and belongs in the
benchmarks. Never rendered in production — `PlayExperience` gates it on `NODE_ENV`.
