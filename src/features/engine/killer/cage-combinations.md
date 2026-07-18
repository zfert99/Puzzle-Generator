# Cage Combinations (`cage-combinations.ts`)

The arithmetic core of Killer Sudoku. Classic Sudoku hands you starting digits; Killer hands
you cage sums instead. So before any cell can be reasoned about, we need to know: for a cage
of `size` cells summing to `sum`, which sets of distinct digits 1–9 are possible?

## Why this is the foundation

- **Magic cages bootstrap the solve.** Some (size, sum) pairs have exactly one possible set —
  2 cells = 3 → `{1,2}`, 2 cells = 17 → `{8,9}`. With no givens, these single-combination
  cages are the *only* place a Killer solve can start.
- **Combination count is a difficulty signal.** A cage with one option is highly constraining
  (easy); a cage with eight options tells you little (harder). The generator later tunes
  difficulty partly by how many combinations its cages allow.
- **Everything downstream depends on it** — the exact solver prunes candidates using these
  sets, and the difficulty grader reasons about them.

## How `combosFor(size, sum)` works

The strategy is **choose digits in strictly increasing order**. We walk digit-by-digit; each
pick must be larger than the previous one. That single rule buys us two guarantees for free:

- **No repeats** — a digit is never reused, because the next pick is always strictly larger.
- **No duplicate sets** — we only ever generate the ascending arrangement of a set (`[1,8]`,
  never also `[8,1]`), so each set appears exactly once.

```text
walk(start, remainingCount, remainingSum):
  if we've placed all cells (remainingCount == 0):
    record the combination IF it hit the target exactly (remainingSum == 0)
    return
  for each candidate digit from `start` up to 9:
    if the digit alone already exceeds remainingSum: stop  (digits only grow from here)
    tentatively take it, recurse from digit+1 with one fewer cell and a smaller target
    put it back and try the next digit
```

The `if digit > remainingSum: break` is the key pruning: because the loop scans digits in
increasing order, the moment one digit overshoots the remaining target, every larger digit
would too — so we abandon the branch instead of scanning to 9.

## `candidateMaskFor(size, sum)` — the union, as a bitmask

The solver rarely needs the full list of digit *sets*; it needs the faster question: "which
digits can appear in this cage **at all**?" That's the union of every combination — e.g. a
2-cell cage of 9 (`{1,8},{2,7},{3,6},{4,5}`) can hold any of `{1..8}` but never a `9`.

We return that set as a **bitmask**: a single number whose bit `(d − 1)` is on iff digit `d`
is possible. `{1,2}` → `0b11`; `{8,9}` → `0b110000000`. This matches the codebase's existing
candidate convention (the board store erases a peer with `~(1 << (digit - 1))`).

Why a bitmask instead of an array:

- **"Is digit d possible?"** is one instruction: `mask & (1 << (d - 1))`.
- **Merging two sets** (the union we build here) is one bitwise OR: `mask |= 1 << (d - 1)`.
- The K2 solver will **intersect** this mask against a cell's own candidate mask (`&`) — the
  fast path for cage-based pruning. (The correctness subtlety — arithmetic possibility vs.
  what rows/cols/boxes already forbid — is the solver's job, not this table's.)

## Compute-once: the frozen lookup table

The solver calls these functions constantly, but the `(size, sum)` universe is tiny and
fixed — 9 sizes × 45 sums. So instead of re-running the recursion per call, we **precompute
every answer once at module load** into `COMBO_TABLE` (indexed `[size][sum]`) and a parallel
`MASK_TABLE`. After that, `combosFor`/`candidateMaskFor` are constant-time array reads.

This is memoization in its simplest form — and eager (build the whole table up front) rather
than lazy (cache on first use), because the input space is small and entirely known.

**The hazard it introduces, and the guard:** once we hand out *cached* arrays, every caller
shares the same object. A single `result.sort()` or `.push()` would silently corrupt the
table for everyone. So the table is **deeply frozen** (`deepFreeze` walks every nested level
and `Object.freeze`s it): any mutation attempt now throws immediately instead of quietly
poisoning the cache. The public return type is `readonly`, which makes the same intent visible
at compile time. Callers who need to mutate must copy first (`[...combo]`).

A knock-on effect worth knowing: `combosFor(3, 15) === combosFor(3, 15)` is now `true`
(same cached instance) — before memoization each call built a fresh array, so it was `false`.
The tests assert this identity with `toBe` (reference equality) to lock the caching in.

## Verification

The tests assert against the **exact numbers from the research report** (`killer-sudoku.md`),
not vague "returns some combinations": the 2-cell unique cages (3, 4, 16, 17), the 2-cell peak
at sum 9 (4 combinations), the 3-cell peak at 15 (8 combinations), the whole-house case
(9 cells = 45), 1-cell cages as de facto givens, and impossibility at out-of-range sums. Mask
tests read via a `digitsInMask` helper so the union behavior is legible. This rigor matters
because this is a hot-path lookup table — a subtle off-by-one would silently corrupt every
puzzle we generate.

## Consistent digits — `guaranteedMaskFor` (union's opposite)

Where `candidateMaskFor` unions the combinations (digits that *could* appear),
`guaranteedMaskFor` **intersects** them (`&`) — digits present in *every* combination, so
*guaranteed* to sit somewhere in the cage. Research example: a 4-cell cage of 13
(`{1,2,3,7},{1,2,4,6},{1,3,4,5}`) forces a `1`. The solver uses this for consistent-digit
eliminations. It's precomputed into its own frozen table alongside the union masks, and is
always a subset of the candidate mask (guaranteed ⊆ possible — asserted in the tests).

## Done — K1 combination oracle complete

`combosFor`, `candidateMaskFor`, and `guaranteedMaskFor`, all backed by frozen precomputed
tables. Cage/puzzle types and validators live in `killer-types.ts`.
