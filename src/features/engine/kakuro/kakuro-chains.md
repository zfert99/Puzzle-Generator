# Kakuro Chains (`kakuro-chains.ts`)

Forcing chains over Berthier's redundant-variable model: what the logical solver's tiers 4
(expert) and 5 (extreme) are made of. Plan slice **E2b**; research gaps G4/G5 in
[kakuro-log.md](../../../../Docs/kakuro-log.md).

## Why a redundant variable per run

Kakuro's sum constraint is not binary — "these three cells sum to 23" relates three things at
once — so the candidate chains that work for Sudoku cannot walk it. Berthier's fix in KakuRules
is to add a CSP-variable per run whose candidates are the run's possible **combinations**. After
that every constraint is a binary link between two candidates:

```text
two digits of one cell                             (a cell holds one digit)
the same digit in two cells of a run               (no repeat within a run)
two combinations of one run                        (a run uses one combination)
a cell-digit and a run-combination that lacks it   (the digit cannot be in that run's set)
```

## What a chain is

Suppose a target candidate is true. Follow the forced consequences along those links only:

```text
a candidate linked to a true one is false
a variable (cell or run) with exactly one candidate left has it true   ← counts as one link
a variable with no candidate left                                       ← contradiction
```

A contradiction proves the supposition false, so the target is eliminated. The number of
forced truths on the way is the chain's **length** — the rating; the solver calls a chain of at
most `CHAIN_TIER4_MAX_LENGTH` (4) tier 4 and anything longer, up to `CHAIN_TIER5_MAX_LENGTH`
(12), tier 5.

This is Berthier's **braid**. A whip is the same with the extra rule that each new link may use
only the previous element of the chain (no "memory"); braids and whips rate puzzles almost
identically, and a braid is what a single propagation loop naturally finds. Every step is a
sound implication, so the elimination is a proof: the solver still never searches, and D10
("zero guesses at every published tier") holds — the contradiction is *derived*, not tried.

## Why the first-found chain is good enough

`findFirstChainElimination` scans cells in order, digits ascending, bound in hand, and returns
the first elimination any chain proves. The tier is set by the bound that *succeeds* (the
solver tries the tier-4 bound before the tier-5 one), not by the shortest possible chain for a
given target — the same "weakest level that finishes" convention every other tier uses.

## Facts before the supposition

A run with a single open combination already holds it. The logical solver has normally applied
that to the masks (tier 1), but a raw context may not have, so single-combination runs are
asserted as facts first, without counting toward the length. A target the facts already rule out
is a chain of length 0.

## Deliberately left out

- **g-whips** (Berthier's g-labels for the "a required digit must land somewhere" link): the
  chain model here only follows binary links. Both chain fixtures and the searched expert/extreme
  fills fall to plain braids; if a future fill needs g-links, that is the signal to add them.
- **Surface sums** (articulation-point sums, research gap G4): an accelerator, not a rung, per
  the plan; not needed by anything yet.
- A whip-only mode (no memory). Braids are a superset; a stricter rating can be added if a
  calibration ever wants it.

## Measured (2026-10-01)

The two original fills (`*_CHAINS`) each need chains of length **exactly 4** — not 3 — after the
tier-3 ladder stalls (27 / 29 cells undecided), which is where the tier-4 bound was set.
Searched fills: 7×7 extreme needs chains of 6 and 10; 9×9 extreme of 8 and 7; the expert fills
one chain of 4 each. Classifying an extreme 7×7 takes ~35 ms; a hint on it ~1 ms.
