# Eval State Set: Plain English Pseudocode

Companion to [`eval-states.ts`](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/hint-agent/eval-states.ts).

## Why a fixed, seeded set

An eval number is only comparable to the last one if the inputs are identical. Everything here
runs off `mulberry32(seed)` (default seed 2026), so the 52-state default set is the same on
every machine and every run. Building it takes under a second.

## Two populations

| Kind | How it is made | What it tests |
|---|---|---|
| `has_deduction` (10 per difficulty × easy/medium/hard/expert) | Positions sampled evenly along a first-deduction solve walk of one generated puzzle per difficulty | Validity, label accuracy, leak |
| `none` (12) | A medium puzzle with clues removed at random until the oracle reports nothing | Refusal vs. hallucination |

The `none` states are where hallucination shows up: the model still gets a full candidate list
from `get_grid_state`, and an agent that reasons from candidates instead of trusting the empty
tool result will invent a move. Most hint evals never include such states because they have no
oracle to say "nothing is available"; this one does.

## buildEvalStates(options) → EvalState[]

```text
FOR each difficulty (index i):
    puzzle = generateSudoku(difficulty, 9, mulberry32(seed + i))
    walk   = walkGrids(puzzle.grid)        // distinct grid strings, opening first
    take every ⌊|walk| / perDifficulty⌋-th grid until perDifficulty collected
rng = mulberry32(seed + 100)
REPEAT until noneCount collected (cap attempts at 4×):
    puzzle = generateSudoku('medium', 9, rng)
    stuck  = digUntilStuck(puzzle.grid, rng); IF found, add as kind 'none'
```

## walkGrids(grid)

Applies the *first* deduction each step (eliminations included) but samples only when a
placement changed the grid. A state is identified by its grid string and the oracle is recomputed
from that string, so sampling after a pure elimination would just duplicate the previous grid.

## digUntilStuck(grid, rng)

Shuffle the filled cells; clear them one at a time; return the first grid string for which
`listDeductions` is empty. Every removal weakens the constraints, so singles disappear first
and eventually nothing fires. The result is not a unique-solution puzzle and does not need to
be — the only thing being tested is whether the agent refuses when the oracle is empty.
