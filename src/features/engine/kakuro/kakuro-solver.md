# Kakuro Solver (`kakuro-solver.ts`)

The exact solver. Two jobs:

1. **`countKakuroSolutions`** — count a puzzle's solutions, stopping at a limit (2 by default:
   all a uniqueness check needs). `isKakuroUnique` wraps it.
2. **`deduceKakuro`** — what propagation alone forces from a partly-filled grid, with no search.
   The Hint button's source.

Plan: [kakuro-implementation-plan.md](../../../../Docs/kakuro-implementation-plan.md) slice E1;
rules `D#` in [kakuro-log.md](../../../../Docs/kakuro-log.md).

## Why this shape

Kakuro's only constraint unit is the **run** — there are no rows, columns or boxes — so the
solver is the Killer/Keisan exact solver with the house machinery removed: 9-bit candidate
masks per white cell, constraint propagation per run, then depth-first search choosing the
cell with the fewest candidates (MRV), with a node budget so a pathological puzzle is reported
as "unknown" rather than hanging a request. Régin-style all-different propagation is deliberately
*not* used: the combination filter below already gives per-run consistency for runs of at most
nine cells (research: overkill at this size).

## Compilation

A puzzle is compiled once per call into flat typed arrays: every white cell knows its across
and down run (two slots per cell, −1 when absent), every run knows its cells and its
combination masks. Black cells have both slots at −1 and are never visited. One shape of data
for every call keeps the hot loops monomorphic (AGENTS.md §5).

## Propagation (`propagate`)

A ring-buffer work queue of runs, each queued at most once at a time. Per run:

```text
cellsUnion = OR of the run's cell masks
fixedMask  = OR of the cells already down to one digit
             (two cells fixed to the same digit → contradiction)

a combination is FEASIBLE if
    every digit of it is still a candidate somewhere in the run       (combo ⊆ cellsUnion)
    every digit already fixed in the run belongs to it                 (fixedMask ⊆ combo)
    every cell still has at least one candidate in it

union    = OR  of the feasible combinations      → no feasible combination: contradiction
required = AND of the feasible combinations

for each cell:
    mask &= union                                 a digit no feasible combination uses is gone
    if the cell is not fixed: mask &= ~fixedMask  all-different: drop digits fixed elsewhere
    an empty mask is a contradiction
    a changed mask re-queues the cell's OTHER run (across ↔ down)

for each required digit not yet fixed:
    count the cells that can still hold it
    none  → contradiction;  exactly one → that cell is forced to it

any new fixed digit → re-queue this run (earlier cells in the loop didn't see it)
```

The feasibility test is **necessary, not sufficient** (it does not check that the digits can be
assigned to cells one-to-one — that is a matching problem). That is the deliberate trade: it is
cheap enough to run at every search node, and the search covers what it misses. The
"required digit held by one cell" rule is the one addition over a plain union filter; it is what
lets propagation alone solve small puzzles outright.

## Search (`countKakuroSolutions`)

```text
propagate everything from the starting grid (a contradiction → 0 solutions)
search(masks):
    one more node; over budget → mark exhausted, stop
    pick the unfixed cell with the fewest candidates (stop scanning at 2 — can't do better)
    no such cell → a solution: record the first, count it, stop if the limit is reached
    for each candidate digit of that cell:
        copy the masks, fix the digit, propagate its two runs; if consistent, recurse
```

A shape with **no runs** is reported as 0 solutions up front (and `deduceKakuro` as a
contradiction): it is not a puzzle, and the ring-buffer queue would be zero-length. The first
draft counted the empty grid as one solution — a review finding. `popcount` is the shared
`grid-utils` one, not a private copy.

Masks are **copied per branch** (one `Int32Array` of cell-count per node) rather than undone
through a trail — simpler, and at these sizes (≤ 169 cells, a dozen nodes for the fixtures)
the copy is nothing. The result carries `nodes` so callers can see the cost, and `exhausted`
so a budget overrun is never mistaken for an answer (`isKakuroUnique` returns `null` for it).

## Deduction (`deduceKakuro`)

Propagate from the given grid, then list every *empty* white cell that is down to one
candidate. No search: a listed digit is one the solver *deduced*, not one copied from the
answer. `contradiction` means the grid — a player's wrong entries included — cannot be
completed, and the caller must not trust the list. The board store's `hint` uses this, and
additionally only accepts a forced digit that matches the solution (see `useBoardStore.md`).

## Measured (fixtures, 2026-10-01)

Uniqueness verify: **0.12 ms** average on both the 7×7 (13 nodes) and the 9×9 (11 nodes) —
the plan's gate was 50 ms. Propagation alone forces 2 of 32 cells on the empty 7×7 and 17 of
55 on the empty 9×9. Fuzzed against an independent brute force on 150 random 3×3/4×4 grids
(exact solution counts, up to 50).
