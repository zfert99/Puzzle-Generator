# SkyscrapersDevBadge: Plain English Pseudocode

A **development-only** readout under a Skyscrapers board (plan slices E1 and E2 in
[skyscrapers-implementation-plan.md](../../../../Docs/skyscrapers-implementation-plan.md)): what
the exact solver says about the puzzle on the board — unique or not, and at what search cost —
plus how many of the 4N clues are present — and, since E2, what the **logical solver** says: the
grade and tier, the two-factor score, the technique histogram (the plan's "rung histogram", G7's
first data), and the clue metrics the generator will read. The plan asks for it as the visible
proof that real solvers sit behind the board, as `KakuroDevBadge` shows for Kakuro.

```text
read edgeClues and the size from the store (useShallow — two fields)
no clues → ["exact: no clues"]
exact = countSkyscrapersSolutions(shape)                    (memoised on clues + size)
line 1 = "exact: " + (budget exhausted → "uniqueness: node budget exhausted"
                      solutions ≠ 1     → "NOT unique — k solutions found"
                      otherwise         → "unique ✓ · n nodes") + " · k of 4N clues"
graded = classifySkyscrapers(shape, { metrics: true })
line 2 = "ladder: " + (tier null → "beyond the ladder (unrated)" | "<difficulty> (tier t)")
         + " · score <final>" + " · <technique×count …>" (or "nothing applied")
line 3 = "metrics: trivial clues · facing sums · fixed · implied · rating"
```

Nodes, not milliseconds: a count is a pure function of the puzzle and can be derived in render,
a wall-clock timing is not (`react-hooks/purity`, the Kakuro E1 lesson) and belongs in the
benchmarks. Never rendered in production — `PlayExperience` gates it on `NODE_ENV`.
