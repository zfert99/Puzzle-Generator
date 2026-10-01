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

plus one non-binary link, Berthier's **g-link** — a combination needs each of its digits held by
some cell of the run — applied in **both directions**:

```text
a combination needing a digit no cell of the run can hold is false   (not a link: nothing is forced true)
a digit every open combination needs, with exactly one holder, is true there   ← counts as one link
```

Left out of the first version entirely (a review finding on E2b); then applied only to a run
whose combination was already true (a review finding on that fix). The one-way form let a chain
kill every holder of a digit two open combinations both needed without noticing — the run stayed
"open" until some other link singled a combination out. Measured when the second direction
landed: chains that needed 6–12 links now need 3–6 (see **Measured** below). This is what makes
the rating comparable to Berthier's, whose g-whips carry the link both ways.

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

Whatever is already forced — a run with a single open combination, a cell with a single
candidate, and whatever those force in turn, g-link included — is established first, **to a
fixpoint**, without counting toward the length. The logical solver has normally applied these to
the masks (tier 1), but the grade must not depend on which caller built the context: the first
version asserted only the single-combination runs and did not iterate, so a chain whose first
link was really a fact could be reported one link longer than it was (a review finding). Every
open variable gets one look in this pass (the scan afterwards only revisits what changed), so a
raw context's g-link facts are found even when nothing is asserted outright. A target the facts
already rule out is a chain of length 0.

If the facts alone contradict, the context is **inconsistent** (a wrong digit somewhere, or a
hand-built context) and no chain from it is a finding: the workspace says so and every target
returns `null`. The first version carried on and could report the context's own contradiction
as the supposition's (a review finding).

## One workspace per step

The open combinations of every run, the working buffers, **and the facts** are built once per
`findFirstChainElimination` (`prepareChainWorkspace`) — hundreds of targets share them, and each
target starts by copying the post-facts snapshot back into the buffers rather than re-deriving
it. The first version rebuilt the combinations per target, the second re-ran the facts fixpoint
per target (both review findings).

The propagation itself (`ChainPropagation`: assert a cell-digit, assert a run-combination, scan
the touched variables) is a small class over the context and the workspace so the facts pass and
the chain walk share one implementation. A forced truth the scan returns is by definition still
open, so asserting it cannot fail — the engine throws if it ever does rather than counting a
phantom link.

The chain also reports `contradictionRun` — the run that emptied, or the run of the cell that
did — which the solver records as the step's `run` so a future "show me where" can point at the
right place.

## Deliberately left out

- **Surface sums** (articulation-point sums, research gap G4): an accelerator, not a rung, per
  the plan; not needed by anything yet.
- A whip-only mode (no memory). Braids are a superset; a stricter rating can be added if a
  calibration ever wants it.

## Measured (2026-10-01)

With the one-way g-link, the two original fills (`*_CHAINS`) each needed chains of length
**exactly 4** after the tier-3 ladder stalls (27 / 29 cells undecided), which is where the
tier-4 bound was set; the searched extreme fills needed chains of 6–12.

With the two-way g-link (review follow-up 4) the same fills need **3** (both `*_CHAINS`), the
experts 2–3, and the first extreme pair only 3–4 — they graded expert and were re-baked. On a
36-puzzle 7×7 corpus (repaired random fills, 32% black) the minimal-bound histogram moved from
`{0:17, 1:1, 3:1, 4:6, 5:4, 6:1, 7:1, 9:2, 10:1, >12:2}` to `{0:17, 1:2, 3:8, 4:5, 5:2, 7:1, 11:1}`:
both "unrated" puzzles became rated, the tail above 4 shrank from 11 to 4 of 19, and the bound of
4 still splits expert from extreme. A 23-puzzle 9×9 corpus (29% and 34% black) moved less:
unrated 5 → 3, extreme 8 → 8, expert 3 → 5 — the long tail is real at 9×9, and the ceiling of 12
is still reached there (E5's question). Classifying the 9×9 corpus halved, 31.6 → 16.9 ms per
puzzle (facts snapshot + shorter chains); the 7×7 corpus stayed at ~4 ms (the two-way scan costs
about what the snapshot saves at that size). The served extremes now need chains of 5 (7×7) and
6 (9×9); classifying them takes ~9 ms and ~18 ms.
