# Eval Grader: Plain English Pseudocode

Companion to [`eval-grade.ts`](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/hint-agent/eval-grade.ts).

## The four numbers

| Metric | Population | Definition |
|---|---|---|
| **validity** | has_deduction | The cells the hint names are all cells of one deduction the oracle lists |
| **label accuracy** | has_deduction | That deduction's strategy matches the strategy the hint names (case/space-insensitive) |
| **leak** | has_deduction | The explanation states the digit a matched *placement* deduction would place |
| **refusal accuracy** | none | The agent answered `hint: null` |

Plus two counts that explain the rates: `unnecessaryRefusals` (refused on a solvable state) and
`hallucinatedHints` (gave a hint on an empty state). And two sanity rates: `parseRate` and
`oracleCallRate` (did it call `list_available_deductions` at all).

## Why validity is a subset test

For singles the deduction has exactly one cell. For elimination techniques the oracle reports
the union of every instance one pass finds (see `deductions.md`), so a hint naming a subset of
those cells is still one real step. Requiring an exact match would penalise correct hints.

## Why the leak check is a heuristic, and scoped to placements

It strips `r#c#` labels and `row 3` / `box 5` phrases from the explanation, then looks for the
placed digit as a standalone number. For elimination techniques naming the eliminated digit is
how the technique is explained, so the check does not apply. This will miss "the answer is
eight" and will flag an innocent "3 candidates"; the writeup's limits section says so.

## gradeRun(state, run, oracle) → Grade

```text
base = { parsed: response ≠ null, calledOracle: 'list_available_deductions' ∈ toolCalls, ... }
IF state.kind = none:
    RETURN base + refusedCorrectly = (parsed AND hint = null)
IF no hint or no cells:
    RETURN base + valid=false, labelCorrect=false, leaked=false    // unnecessary refusal
matches = oracle deductions whose cell set ⊇ normalised hint cells
valid        = |matches| > 0
labelCorrect = any match's strategy ≈ hint.strategy
leaked       = any match has a placement whose digit appears standalone in the explanation
```

## summarize(model, grades) → Summary / formatSummary

Rates are per population; a `null` metric never counts against a state it does not apply to.
`formatSummary` is the block the writeup quotes verbatim.
