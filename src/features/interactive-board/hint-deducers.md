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
             solution; else deduceSkyscrapers's forced cells → pickAgreeing; contradiction → null
             (the same shape as kakuro's — the explainer itself places the selected cell first)
agreesWithSolution(ctx, f): the one place a candidate is checked against the answer (L9)
pickAgreeing: the preferred cell if forced and agreeing, else the first forced cell that agrees
result:      { target: { r, c }, note: { cell, digit, technique, explanation, leadUp } }
```

## Why the Skyscrapers deducer has no precedence of its own (E2 review)

Skyscrapers' ladder opens with **placement** rules that pick their own cell — `clueN`, `clue1`,
`facingSum` — so with the first draft of the explainer (singles-only preference, as Kakuro's) the
named next step from an empty board was almost never the cell the player had selected, and the
deducer grew a Skyscrapers-only rule: ask the exact solver whether the selected cell is forced
and hint it unexplained. The review called that a bandaid at the wrong depth. The fix lives in
`explainSkyscrapersHint`: with a preferred cell, **every** placing technique is confined to that
cell first (eliminations still run anywhere), so a selected cell the board can deduce is hinted
*by name* — "(3,1) is 3: the heights climb 1 to 4" — and only when no rule can place it does the
ladder place elsewhere. The two deducers are now the same shape, and the store tests pin both
orders (selected cell named; ladder's placement elsewhere when nothing can place the selection).
