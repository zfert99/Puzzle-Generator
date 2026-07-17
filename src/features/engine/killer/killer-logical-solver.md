# Killer Logical Solver (`killer-logical-solver.ts`)

Solves a Killer the way a *human* would — applying techniques in difficulty tiers and recording
the hardest one required. That "hardest tier" is the difficulty grade the generator (K5) will
use. Separate from the exact solver (`killer-solver.ts`), which brute-force counts solutions for
the uniqueness gate; this one never guesses.

## Why it composes `HumanSolver` (never inherits)

AGENTS.md §1 bans inheritance for the solvers, and there's no need for it: `HumanSolver` already
holds a bitmask candidate grid (public `grid`/`candidates`, same bit convention as the cage
code) and exposes the classic techniques as standalone functions (`applyNakedSingle(solver)`,
…). So this solver **drives a `HumanSolver` instance** — using it as the candidate grid and
classic-technique engine — and interleaves the Killer-specific cage deductions. No shared-state
gymnastics, no `extends`.

## Built one tier at a time

Techniques are added tier by tier so each can be **verified sound before the next is layered
on** — an unsound step is worse than a missing one (it corrupts the grid and mis-grades). This
file currently implements **Tier 1 + Tier 2**.

### Tier 1

- **Cage-combination elimination** (foundational — every Killer needs it, since there are no
  givens). For each cage, restrict its remaining cells to `candidateMaskFor(cellsLeft, sumLeft)`
  minus digits already used in the cage. A single-combination ("magic") cage fixes its cells to
  the combo's digits. Sound by construction (K1 arithmetic + no-repeat only remove impossible
  digits).
- **Single-house Rule of 45.** Every house sums to 45. If cages lying entirely within a house
  cover all but one cell (an "innie"), that cell = 45 − (sum of those cages).
- **Classic singles** — naked and hidden singles, via `HumanSolver`.

### Tier 2

- **Consistent-digit / cage-locked-candidate.** A digit `guaranteedMaskFor` says appears in
  *every* completion of a cage must sit somewhere in that cage. If all the cage cells that can
  still hold it share a house (row/col/box), it's eliminated from the rest of that house — the
  cage acts like a pointing set. Sound because `guaranteedMaskFor` is a *subset* of the true
  guaranteed set (it ignores no-repeat, only shrinking the claim), so every "guaranteed" digit
  really is.
- **Classic pairs** — naked and hidden pairs, via `HumanSolver`. Once cage arithmetic has seeded
  candidates, these capture the cross-cage-boundary naked-subset eliminations for free.

## Soundness, and a bug it caught

The non-negotiable property: on a *unique* puzzle, every forced digit IS the solution's digit,
so any placement that disagrees is an unsound deduction. The test suite asserts **zero** wrong
placements over dozens of generated puzzles across cage sizes.

That test earned its keep immediately. The first Rule-of-45 implementation reused
`HumanSolver.buildHousePositions()` as "the houses" — but that method returns per-(digit, house)
lists of *empty* candidate cells (for hidden-single detection), **not** the 27 full houses. The
fragments didn't sum to 45, so the innie deduction placed wrong digits (45 unsound placements at
maxSize 4). Fix: build the real rows/columns/boxes here. Lesson baked into the code comment: the
Rule of 45 is only sound on genuine `size`-cell houses.

## The solve-rate gradient = the difficulty signal

Cumulative reach, measured over generated puzzles by cage size:

| maxSize | Tier 1 | Tier 1 + 2 |
|---|---|---|
| 2 | ~100% | ~100% |
| 3 | ~72% | ~78% |
| 4 | ~8% | ~15% |

This is exactly the difficulty gradient we grade by: small-cage puzzles are Tier-1 "easy"; each
added tier reaches a few more of the larger, looser puzzles. The remainder awaits Tier 3+.

## Not yet here

- **Tier 3+** — multi-unit Rule of 45 / cage splitting / pseudo-cages, classic triples/hidden
  subsets; then Tier 4 fish/wings/chains (`HumanSolver`'s advanced/extreme strategies). Added one
  verified tier at a time.
- **Grading integration** — K5 will loop generation until the graded tier matches the requested
  band; right now the solver just reports the tier.
