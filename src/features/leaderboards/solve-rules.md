# Solve Rules (`solve-rules.ts`)

Pure anti-cheat rules for a daily solve — no DB, no clock — so they are unit-testable and
live in one reviewable place.

## Why pure, and why pragmatic

**Why:** The services apply these around the server-authoritative timing and grid data;
keeping the rules pure means the (easy to get subtly wrong) checks are tested in isolation.
The posture is deliberately **pragmatic** (project decision): we keep serving the solution
to the board so hints/mistake-highlighting work, and rely on these server-side checks
rather than hiding the solution — a sudoku is externally solvable anyway.

## `gridsMatch(a, b)`

**Why:** The server verifies a submitted grid against the stored solution before recording
any time — you can't rank without actually solving it. Deep cell-by-cell equality.

## `MIN_SOLVE_MS` / `isImplausiblyFast(difficulty, timeMs)`

**Why:** Rejects a submission faster than any human could solve (i.e. instant autofill).
The floor only needs to exclude the impossible, not police fast solvers, so it is set
conservatively below real human records and rises with difficulty.

```text
MIN_SOLVE_MS: easy 15s · medium 20s · hard 25s · expert 30s
isImplausiblyFast(d, t) -> t < MIN_SOLVE_MS[d]
```
