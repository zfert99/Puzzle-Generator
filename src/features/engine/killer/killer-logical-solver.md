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
file implements the full ladder, **Tiers 1–4**.

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

### Tier 3

- **Multi-unit Rule of 45.** Extends the innie idea to regions that are unions of 1–3 whole rows
  or columns (total = 45 × houseCount), and adds **outies**: a single cell of a cage reaching out
  of the region = (sum of all cages touching the region) − total. Single-house innies stay Tier 1;
  multi-house innies and all outies are Tier 3. Sound — pure arithmetic over known house totals.
- **Classic pointing pairs** (box-line reduction), via `HumanSolver`.

### Tier 4

- **Classic advanced + extreme strategies** — X-Wing, Swordfish, Y-Wing, XYZ-Wing, then W-Wing,
  ALS-XZ, AIC, via `HumanSolver` (9×9 only, mirroring its own gating). Once cage arithmetic has
  seeded the candidate grid, these operate over it unchanged — the Phase 1 engine reused wholesale.
  Sound: they only ever eliminate candidates / place forced digits on a valid candidate grid.

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

| maxSize | Tier 1 | + Tier 2 | + Tier 3 | + Tier 4 |
|---|---|---|---|---|
| 2 | ~100% | ~100% | ~100% | ~100% |
| 3 | ~72% | ~78% | ~86% | ~88% |
| 4 | ~8% | ~15% | ~18% | ~21% |

This is exactly the difficulty gradient we grade by: small-cage puzzles are Tier-1 "easy"; each
tier reaches a few more of the larger, looser puzzles. The ~12% / ~79% of maxSize-3/4 layouts the
full ladder still can't crack are simply **beyond the implemented techniques** — for grading that
just means they're ungradeable and K5 discards them (it only ships puzzles it can grade).

## The `maxTier` cap (grading speed)

`solve({ maxTier })` runs only techniques up to `maxTier` (default 4 = all). The generator
passes the *target* tier, so grading a would-be "medium" never pays for the expensive Tier-4
strategies: a puzzle needing more than `maxTier` simply returns `solved: false` — a cheap
reject. This is the lever that makes difficulty-graded generation nearly free (see
`killer-sudoku.md`).

## The solve trace feeds two-factor scoring

The deduction loop is a **tier-ordered technique table** (name, tier, apply), tried cheapest
first each pass, restarting from the top after any hit so ripple effects are always exhausted
before anything harder runs. Besides the grade, `solve()` returns the raw material for the
two-factor difficulty score (`killer-score.ts`):

- `techniqueCounts` — how many times each named technique fired (how much of *what* work);
- `passes` and `avgOpenSingles` — at each pass start, one cheap popcount scan counts how many
  naked singles are *simultaneously* available. The mean is the opportunity-density signal:
  many parallel moves = an open, forgiving grid; near zero = a bottlenecked one that plays
  harder than its technique list suggests.

The sampling is a single 81-cell scan per pass (~µs), so grading cost is unchanged.

## Reach vs. what v1 ships

Measured, the solver grades **tiers 1–3 abundantly**; tier-4 *solvable* layouts are a thin band
and larger cages are dominated by puzzles beyond the current techniques. So K5 ships
easy/medium/hard (tiers 1–3). Tier 4 stays wired and graded (and is exercised soundly by the
maxSize-4 tests) for when more Killer techniques are added — cage splitting, deeper chains — to
fill that band and unlock expert/extreme.

## E2: Killer-tough techniques + the 0–5 tier remap (July 2026)

`KillerTier` grew to 0–5 (expert plan, slice E2). Tiers 1–3 are FROZEN — the shipped
easy/medium/hard caps depend on their semantics. The old catch-all tier 4 split:

- **Tier 4 — Killer-tough (expert's ceiling):** two new techniques plus classic
  X-Wing/Swordfish/Y-Wing.
  - `cageComboRestriction` ("hard combinations"): filters each cage's combinations by the
    current candidate grid — every combo digit needs a home cell, and the combo must pass
    **Hall's condition** (every digit-subset has enough host cells; ≤ 2⁵ subsets, trivially
    cheap). Digits in no viable combination are eliminated. Sound because viability only
    over-approximates.
  - `ruleOf45MultiCell`: tier 3 places single innies/outies; this generalizes to 2–4-cell
    leftovers as **pseudo-cages** with known sums — sound only under a distinctness
    guarantor (all cells share a cage, row, column, or box; guarantors' placed digits feed
    `candidateMaskExcluding`). Regions now include **single boxes** (previously only
    row/column unions, so box innies/outies could never fire).
- **Tier 5 — extreme:** XYZ-Wing, W-Wing, ALS-XZ, AIC (the old tier-4 tail).

`solve({ disable })` skips named techniques — the capability-toggling hook the necessity
tests use (research: never infer necessity from a single trace; disable and re-solve).

**Measured gate (E2): met.** Gradable maxSize-4 unique layouts went ~7% (pre-E2 techniques,
same fixture set) → 33% (same-cage-only pseudo-cages) → **57%** (house guarantors + Hall +
box regions), with 93 logically-solved layouts fuzzing 0 mismatches against the exact
solver. Tier spread on that set: 14× tier 4, 3× tier 5 — both new bands are populated.
Existing tiers unaffected: identical traces for puzzles solvable ≤ tier 3 (cheapest-first
ordering), bands hold, generation 9/75/291 ms.
