# hint-deducers: Plain English Pseudocode

The solver-driven hints behind the board's Hint button, one deducer per variant that has a
solver (Kakuro since its E1/E2; Skyscrapers since its E1, explained since E2 — plan slices E1/E2 in
[skyscrapers-implementation-plan.md](../../../Docs/skyscrapers-implementation-plan.md)). The
store's `hint` action asks `deduceHintFor(variant, ctx)` first and falls back to the plain
reveal when it answers `null`.

## Why a registry, not branches in the store

The store action used to hold one `if (variant === 'kakuro')` block and, after Skyscrapers E1,
a second near-identical one (the Skyscrapers E1 review's altitude finding). The two differ only
in which engine they call and how the note is worded; the shared rule — **place only a deduction
that agrees with the solution** (Kakuro L9: propagation from a board holding a mistake can force
a digit consistent with the mistake) — was duplicated. Now the rule lives once (`pickAgreeing`),
each engine is a small function, and wiring a new variant's solver to the Hint button is one
entry in `DEDUCERS`.

## `HintContext`

A narrow view of the store — grid, solution, config, the preferred cell (the selection when it
is empty and editable, else `null`), Kakuro's runs, Skyscrapers' edge clues. Never the store
itself, so the deducers are plain functions the engine tests can call.

## `deduceHintFor(variant, ctx)`

```text
deducer = DEDUCERS[variant]; none → null (the store reveals)
kakuro:      explainKakuroHint (a named technique with a reason) if it agrees with the solution;
             else deduceKakuro's forced cells → pickAgreeing; contradiction → null
skyscrapers: explainSkyscrapersHint (a named technique with a reason) if it agrees with the
             solution; with a preferred cell, that explained step wins only when it IS the
             preferred cell — otherwise the exact solver's forced value for the preferred cell
             wins (unexplained), then the explained step, then the first forced cell that agrees;
             contradiction with nothing explained → null
pickAgreeing: the preferred cell if forced and agreeing, else the first forced cell that agrees
result:      { target: { r, c }, note: { cell, digit, technique, explanation, leadUp } }
```

## Why Skyscrapers lets the selected cell beat the explained step (E2)

Kakuro's explained step and its "hint the selected cell" promise rarely conflict: its ladder opens
with eliminations, and the Latin singles are restricted to the preferred cell. Skyscrapers' ladder
opens with **placement** rules that pick their own cell — `clueN`, `clue1`, `facingSum` — so from
an empty board the next named step is almost never the cell the player selected. Rather than
detour (apply other placements until the selected cell falls — which would make the explanation
cite cells not on the board, L13), the deducer asks the exact solver whether the selected cell is
forced *now*; if so, that is the hint, with the unexplained "forced by the clues" note. The named
step is the hint whenever no cell is selected or the selected one is not yet forced. Both
behaviours are store tests.
