# hint-deducers: Plain English Pseudocode

The solver-driven hints behind the board's Hint button, one deducer per variant that has a
solver (Kakuro since its E1/E2; Skyscrapers since its E1 — plan slice E1 in
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
skyscrapers: deduceSkyscrapers's forced cells → pickAgreeing; contradiction → null
             (E2 adds the explained step in front, exactly as Kakuro's)
pickAgreeing: the preferred cell if forced and agreeing, else the first forced cell that agrees
result:      { target: { r, c }, note: { cell, digit, technique, explanation, leadUp } }
```
