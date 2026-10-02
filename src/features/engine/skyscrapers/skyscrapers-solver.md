# Skyscrapers Exact Solver (`skyscrapers-solver.ts`)

The exact solver for Skyscrapers (plan slice E1 in
[skyscrapers-implementation-plan.md](../../../../Docs/skyscrapers-implementation-plan.md)): it
counts a puzzle's solutions (stopping at a limit, normally 2) and finds the heights pure
propagation forces from a partly-filled grid. It backs the uniqueness proof of every served
puzzle and the Hint button (via the store), and E4's generator will call it per candidate clue
set.

## Why this shape

Every constraint in Skyscrapers is a **line** constraint: a row or column is a permutation of
1..N (the Latin rule) whose two clues it must satisfy (the visibility rule). So the solver's
constraint unit is the line, and its single propagation step is **permutation filtering**: a
line keeps the list of permutations its clue pair admits (from the visibility table), narrows it
to those compatible with the cells' current candidates, and ORs the survivors' heights back into
the cells. That one step is all-different *and* visibility at once — there is no separate
singles rule, no position bound, no clue-2 pattern; the research's "Easy rules" are special
cases of it and would only re-derive what the filter already knows. The cost is bounded by the
list length, which only ever shrinks.

Everything else is the Killer / Keisan / Kakuro shape: N-bit candidate masks per cell, a
compiled puzzle in flat typed arrays, a work queue of lines, MRV depth-first search with a node
budget and an early exit at the second solution (AGENTS.md §5: monomorphic, no per-call
allocation in the hot loop).

## Compilation

```text
compile(shape):
    table      = permutationTable(N)
    for each row r:    lineCells[r]     = its N flat cell indices left→right
                       lineBucket[r]    = table bucket for (left[r], right[r])
    for each column c: lineCells[N + c] = its N flat cell indices top→bottom
                       lineBucket[N+c]  = table bucket for (top[c], bottom[c])
    cellLines[cell]    = [its row line, its column line]
```

## Propagation

```text
filterLine(line):
    for each permutation p still in the line's survivor list:
        keep p only if every position's height is still a candidate in that cell
    OR the kept permutations' heights per position
    no survivor → contradiction
    AND the per-position masks into the cells; a cell that shrank re-queues its OTHER line
propagate: pop lines from a ring-buffer queue (a line is queued at most once) until nothing moves
```

The survivor list is compacted **in place**, so it is private to the node that narrows it: the
root takes a copy of every bucket, and each search node copies every list before branching (2N
small arrays — the lists are already narrowed by the parent, so this is cheap below the first
few levels). A child never narrows its parent's list.

## Search (`countSkyscrapersSolutions`)

```text
masks = singleton for a placed height, 1..N for an empty cell
propagate every line; contradiction → 0 solutions
search(masks, lists):
    nodes += 1; over budget → exhausted, stop
    pick the cell with the fewest candidates (> 1); none → a solution (record the first), stop at limit
    for each candidate height of that cell:
        copy masks and lists, set the cell, queue its row and column, propagate, recurse
```

`isSkyscrapersUnique` is the two-solution count with `null` on budget exhaustion — the
generator must never read an exhausted count as "unique".

## Deduction (`deduceSkyscrapers`)

Propagation only, from the player's grid: every empty cell left with one candidate is forced.
Sound — a forced height is in every completion — but a grid that already holds a mistake can
force heights consistent with the mistake and wrong against the answer, so the store's hint
checks each against the solution before placing it (Kakuro L9). A grid that cannot be completed
reports `contradiction` and the hint falls back to a reveal.

## Measured (fixtures, 2026-10-02)

See the plan's E1 step-log and the log's Measurements row for node counts and the uniqueness
verify time on the 7×7 against the 50 ms gate.
