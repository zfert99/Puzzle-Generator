# Killer Types (`killer-types.ts`)

The data shapes for Killer Sudoku and the validators that keep generated puzzles honest.

## Why a discriminated union (`variant`)

A `Puzzle` is either a `ClassicPuzzle` or a `KillerPuzzle`, and each carries a literal
`variant: 'classic' | 'killer'` tag. That tag is a **discriminant**: when code checks
`puzzle.variant === 'killer'`, TypeScript *narrows* the type and only then lets it reach
`puzzle.cages`. A classic puzzle has no `cages`, so this makes it impossible to read cage data
off the wrong kind of puzzle — the compiler forces every consumer (board store, PDF, API) to
handle both cases explicitly instead of hitting `undefined.cages` at runtime.

This is why we tag rather than, say, making `cages` an optional field on one shared type: an
optional field lets callers *forget* to check; a discriminated union makes the check mandatory.

## Why flat cell indices

A cage stores its cells as flat integers (`row * size + col`), not `{r, c}` objects. One
integer per cell is cheaper to store, put in a `Set`, and compare, and it converts back
trivially: `row = Math.floor(index / size)`, `col = index % size`. The whole engine speaks
this representation.

## Connectivity: `isCageConnected`

A cage must be one connected blob — you can walk between any two of its cells through shared
edges. We check with a **flood fill (BFS)**: start at the first cell, repeatedly step to any
orthogonal neighbor that's also in the cage, and afterwards confirm we reached *all* of them.
If the visited count matches the cage size, it's connected.

Two edge cases the tests pin down:

- **Diagonal touch is not connectivity** — cells meeting only at a corner are separate.
- **No row wraparound** — flat indices 3 and 4 are consecutive integers but sit at the end of
  one row and the start of the next, so they are NOT neighbors. `orthogonalNeighbors` guards
  this with explicit row/col edge checks.

This is the same neighbor logic the cage *generator* (K3) will use to grow cages — generation
builds connectivity; validation confirms it. Writing it once here means both sides agree.

## Why validators return an error list, not a boolean/throw

`validateKillerCages` returns a `string[]` of every problem it finds (empty = valid) rather
than throwing on the first. When the generator produces a bad partition, seeing *all* the
violations at once ("cell 5 uncovered", "cage 3 sum mismatch") is far more useful for
debugging than a single early throw. It's a validation report, not an assertion.

**Invariants checked** (from the plan): cages cover every cell exactly once (a true
partition), each cage is connected and sized 1–9, no digit repeats within a cage in the
solution, and each cage's `sum` equals its solution total.

The validators are deliberately **size-agnostic** (they read `solution.length`), so they can
be unit-tested on a tiny 4×4 grid even though v1 puzzles are 9×9.
