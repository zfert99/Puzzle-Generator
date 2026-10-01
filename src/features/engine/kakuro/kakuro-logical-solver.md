# Kakuro Logical Solver (`kakuro-logical-solver.ts`)

Solves the way a human does: named techniques, applied cheapest-first, with the hardest one
needed recorded as the grade. Three things come out of it:

1. **The grade** — `classifyKakuro`: the weakest tier that finishes the puzzle without search
   (Simonis' definition, research gap G9), mapped to a published difficulty. If the ladder built
   so far cannot finish, the puzzle is `'unrated'` — never guessed at (plan decision D8/D10).
2. **The explanation** — `explainKakuroHint`: the next placement a human could make from the
   board as it stands, with its technique and a plain-English reason, plus the eliminations it
   took to get there. The Hint button's source.
3. **The instrumentation** — `measureKakuro`: Mathimagics' `fixed` / `implied` / `rating` and
   the structural numbers (plan §1) the generator will calibrate against. `classifyKakuro`
   runs it only on request (`metrics: true`) — it is two extra full solves, which a generator
   grading hundreds of candidates must not pay by default.

Distinct from the exact solver (`kakuro-solver.ts`), which counts solutions for the uniqueness
gate and never explains. A class with no inheritance (AGENTS.md §1). Plan slice **E2a**: tiers
1–3. The chain tiers (T4 whips, T5 g-whips) are **E2b** and not built — `KakuroTier` reserves
4–5 for them.

## The ladder

| Tier | Technique | What it is |
|---|---|---|
| 1 | `comboRestriction` | A run's empty cells may only hold digits from some combination for the sum still to make over the cells still empty, avoiding digits already placed in it. One combination = the classic "16-in-two: only {7,9}". |
| 1 | `nakedSingle` | An empty cell with one candidate takes it. |
| 2 | `hiddenSingle` | A digit every remaining combination needs, which only one empty cell can take. |
| 2 | `feasibleCombos` | Simonis' shaving: keep only combinations every digit of which some cell can take and that leave every cell a digit; restrict to the union. Cross-references what the crossing runs have ruled out. |
| 3 | `nakedSubset` | k empty cells whose candidates together are exactly k digits claim them (pairs, triples). |
| 3 | `hiddenSubset` | Two digits the run **must** contain, confined to the same two cells → those cells hold only them. |
| 3 | `sumBounds` | A candidate is impossible if, with it placed, the other cells' smallest candidates overshoot what is left, or their largest undershoot it. |
| 3 | `runAssignments` | For a short run, enumerate every real fill (distinct digits, right sum); a candidate in no fill is gone. The exact form of what tier 2 approximates. |

Each technique makes **one** deduction and returns it as a `KakuroStep` (or `null`), so a step
is one nameable thing and the loop restarts from the cheapest technique after every change. That is both what keeps the grade
honest (a tier-3 step never fires while a tier-1 step is available) and what makes the lead-up
of a hint readable.

### Why "hidden" rules need the *required* check — the trap (B5)

In Sudoku a hidden pair is sound because every house must contain every digit. A Kakuro run
need not contain any particular digit, so two merely-possible digits confined to two cells prove
nothing. Hidden single and hidden pair here only consider digits that appear in **every**
remaining combination. The first draft skipped that for the pair and placed a wrong digit on a
fixture; the soundness run caught it before any test existed, and the soundness tests now pin
it (every placement equals the solution; no elimination removes a solution digit).

### Why there is no "locked candidates" rule

Two Kakuro runs intersect in at most one cell, so "a digit confined to cells that all share the
same other run" is the same as "confined to one cell" — which is the hidden single. The plan
listed locked candidates under tier 3 from the research's ladder; in this engine it collapses.

## Metrics (`measureKakuro`)

Structural: white cells (NCELL), longest run (MRL), mean cell run length (ACRL — each cell's two
run lengths averaged, then averaged over cells), black density, the run-length histogram, and
the number of magic runs. Solving: `fixed` = cells placed by a tier-1-only solve, `implied` =
by a tier-1–2 solve, `rating` = mean candidates per white cell after that tier-2 pass (1.0 =
shaving alone solves it — Mathimagics' meaning).

## Trusting a player's grid

Placed digits are taken as given, but checked up front: a digit repeated within a run, a
completed run with the wrong sum, or placed digits already exceeding a clue set `contradiction`
in the constructor. No technique would ever revisit a run with no empty cells, so this is the
only place such a run is looked at (a review finding — the first version let a complete-but-
wrong run feed residuals to its neighbours).

## Explaining (`explainKakuroHint`)

Runs the ladder from the given grid until a technique places a digit. With `preferCell` (the
player's selection), **eliminations run ahead of placements**: every elimination technique at or
below the cap is exhausted before any other cell is placed, and the preferred cell is placed the
moment it becomes deducible (a naked single, or a hidden single in one of its runs). So the hint
lands on the selection whenever it follows from the board as it stands — and every line of the
lead-up is true of the player's board. If another cell genuinely has to be placed first, that
placement is returned and the preference is ignored.

`maxDetour` (default 0) exists for a caller that will *also* apply intervening placements; the
board store never passes it. The first version detoured by default and could explain the
selected cell with "down 3-in-one" when the player's down run still had two empty cells — the
placements it assumed lived only inside the solver (a review finding).

A contradictory grid (a wrong entry) returns `null`; the store falls back to the exact solver's
propagation and then to a reveal.

## Measured on the served fixtures (2026-10-01)

| Fixture | Tier | Techniques | fixed / implied / rating |
|---|---|---|---|
| 7×7 easy | 1 | restriction + singles | 32 / 32 / 1.00 |
| 7×7 medium | 2 | + hidden singles, feasible combos | 5 / 32 / 1.00 |
| 7×7 hard | 3 | + sum bounds, naked subset | 7 / 8 / 3.41 |
| 9×9 easy | 1 | restriction + singles | 55 / 55 / 1.00 |
| 9×9 medium | 2 | + hidden singles, feasible combos | 8 / 55 / 1.00 |
| 9×9 hard | 3 | + sum bounds, subsets, run assignments | 22 / 22 / 2.86 |

The two original fills (now `*_CHAINS`) stall at tier 3 with 27 / 29 cells undecided and are
the E2b test material. Classifying a 9×9 takes ~6 ms.

## Known cost, deferred to E5

Every `step()` rescans all runs with fresh small allocations and restarts from the cheapest
technique, so a solve is O(steps × runs × techniques) — ~6 ms for a 9×9 today. A generator
grading hundreds of candidates per accepted puzzle will feel it (a review finding). The fix is
mechanical — per-run dirty flags so a technique only revisits runs touched since it last ran,
and typed-array scratch buffers — and is deliberately left for E5, whose gate (< 500 ms per
accepted easy/medium/hard 9×9) is the tripwire that says whether it is needed.
