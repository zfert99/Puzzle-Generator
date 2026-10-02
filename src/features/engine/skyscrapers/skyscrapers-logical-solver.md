# Skyscrapers Logical Solver (`skyscrapers-logical-solver.ts`)

Solves the way a human does: named techniques, applied cheapest-first, with the hardest one
needed recorded as the grade (plan slice E2 in
[skyscrapers-implementation-plan.md](../../../../Docs/skyscrapers-implementation-plan.md)). Three
things come out of it, the same three as `kakuro-logical-solver.ts`:

1. **The grade** — `classifySkyscrapers`: the weakest tier that finishes the puzzle without search
   (Simonis' definition, via Kakuro G9), mapped to a published difficulty by `TIER_DIFFICULTY`
   (1 easy … 5 extreme, provisional until E5 calibrates it). If the ladder cannot finish, the
   puzzle is `'unrated'` — never guessed at (decisions D6/D7).
2. **The explanation** — `explainSkyscrapersHint`: the next placement a human could make from the
   board as it stands, with its technique, a plain-English reason, and the eliminations it took
   to get there. The Hint button's source (`hint-deducers.ts`).
3. **The instrumentation** — `measureSkyscrapers`: the research's structural levers (§3) and
   what tiers 1–2 alone achieve — Mathimagics' `fixed` / `implied` / `rating` shape — for the
   generator to calibrate against (E5). `classifySkyscrapers` runs it only on request
   (`metrics: true`): two extra solves a generator grading hundreds of candidates must not pay.

Distinct from the exact solver (`skyscrapers-solver.ts`), which counts solutions for the
uniqueness gate and never explains. A class with no inheritance (AGENTS.md §1).

## Why grade by technique when the exact solver already "solves" the 5×5

E1's line filter at fixpoint placed all 25 cells of the 5-clue 5×5 fixture from an empty grid.
That is what a *propagator* can do, not what a *person* does: the same fixture needs tier-3 line
filtering here and grades **hard**. The research's warning about SAT-style metrics (a solver's
ease is not a human's) is built into this file's shape — the grade is the hardest named rung a
human would have to climb, with the cheap rungs always tried first.

## The ladder

| Tier | Technique | What it is |
|---|---|---|
| 1 | `clueN` | A clue of N: the heights climb 1, 2, …, N from that edge — place the first unplaced one. |
| 1 | `clue1` | A clue of 1: only the tallest tower is visible, so N stands next to the clue. |
| 1 | `facingSum` | Facing clues a + b = N + 1: the tallest tower is a − 1 in from the a side (it is the only tower both sides see). |
| 1 | `positionBound` | Under a clue c, the cell at distance d can be at most N − c + 1 + d: anything taller would hide too many of the towers the clue still needs to show. |
| 1 | `nearlyFilledClue` | c − 1 towers are already visible and N is not among them: only N can still be seen, so the next cell cannot hold a height strictly between the tallest so far and N. (Reachability subsumes it; kept as a named rung because every guide teaches it.) |
| 1 | `nakedSingle` / `hiddenSingle` | The Latin singles — sound without a `required` guard here (see below). |
| 1 | `lineScan` | The one-line arrangement scan (below) when **≤ 3** arrangements of the line still fit its clues: "only two arrangements of this row fit" — the beginner's clue-reading. |
| 2 | `clue2Pattern` | Conceptis's clue-2 rules, named for friendlier hints: N − 1 is never second from the clue; a 1 next to the clue puts N right behind it; with N placed d cells in (d ≥ 2) the first tower is at least d. |
| 2 | `reachability` | Walk the filled prefix, then ask of each candidate at the next cell: with it placed, can exactly c towers still be seen? Too many already, too few reachable with the cells left, or N already seen with the count short — the candidate goes. |
| 2 | `lineEnumeration` | The same scan when **4–12** arrangements fit: a real enumeration of one line, still one line at a time. |
| 3 | `lineFilter` | The same scan when **more than 12** arrangements fit: every arrangement of a line that matches its clues, a height no arrangement puts in a cell is impossible there — Tatham's `solver_hard` and the research's catch-all. Every band **stops after the first productive line** so diagnostics do not inflate the record (Tatham's rule); unclued lines are skipped (the Latin rules own them). |
| 3 | `nakedSubset` | k empty cells of a row or column whose candidates together are exactly k heights claim them (pairs and triples). |
| 3 | `hiddenSubset` | Two heights a row or column still needs, confined to the same two cells: those cells hold only them. |
| 4 | `xWing` | One height, two rows (or columns) where it can stand in the same two columns (rows) only: it stands nowhere else in those columns (rows). |
| 5 | `forcingChain` | For a cell with two or three candidates, suppose each in turn and propagate with tiers 1–4 (up to 200 steps); a supposition that contradicts itself is eliminated. Tatham's `latin_solver_forcing`. |

Each technique makes **one** deduction and returns it as a `SkyscrapersStep` (or `null`), and the
loop restarts from the cheapest technique after every change — so a tier-3 step never fires while
a tier-1 step is available, which is what keeps the grade honest and the hint's lead-up readable.
Within a tier the visibility rules run before the Latin rules (Tatham's loop, the human guides).

### Why the Latin rules need no `required` guard (L1)

Kakuro's hidden single and hidden pair had to consider only digits every remaining combination
needs, because a run need not contain any particular digit. A Skyscrapers row or column is a full
permutation — every height appears exactly once — so the Sudoku forms are sound unchanged. The
test file asserts it on record (a hidden single on a full permutation places the solution's
height), so the question is answered once rather than re-asked per technique.

### Why the line scan is three techniques, graded by how much it scanned (E3 §3c)

The per-line arrangement scan is one mechanism — enumerate the line's arrangements that match
its clues, drop any height no arrangement allows — but it is not one difficulty. E3 measured the
all-clue tier floor of random unique squares with the scan sitting flat at tier 3: **273 of 300
6×6 squares graded hard with every clue on the board**, so clue removal (which only moves a
puzzle up) could never produce an easy or medium 6×6. The same measurement showed the scans
those squares need mostly cover **1–6 surviving arrangements** — at 5×5 a third of them exactly
one. A player who reads "clue 3 and clue 1 on this row: only 1 3 2 4 fits" is doing the
beginner's move in every published ladder, not a hard technique. So the scan is graded by its
**survivor count** before the step: `lineScan` (≤ `LINE_SCAN_MAX` = 3) at tier 1,
`lineEnumeration` (≤ `LINE_ENUMERATION_MAX` = 12) at tier 2, `lineFilter` (beyond) at tier 3.
The ladder asks for the weakest band first, and each band fires on its first productive line.
The bands are one ordered table (`LINE_BANDS`): each band's lower bound is the previous band's
upper bound plus one, so a survivor count always falls in exactly one band. The scan itself is
kept **per clued line** and recomputed only for lines marked dirty: every candidate write goes
through one method (`setCandidates`) that dirties the cell's row and column scans, so a restrict
rescans at most two of the 2N lines and the cache cannot go stale by a write that forgot to
invalidate it (the E3b review's two efficiency/altitude findings — after the change, classify
is faster than before the re-tier: 0.24 / 5.1 / 4.5 ms on the fixtures). Unclued lines are not
in the scan at all (the Latin rules own them), so the scan array has one shape; a finished line
reports one arrangement and nothing to remove without a scan. Each scan stores the candidate
bits no surviving arrangement uses (`removable`), which is both the "is it productive" test and
the elimination the band applies. After the re-tier the 6×6 all-clue floor is **25% easy / 61% medium / 2% hard** (the
rest expert/extreme), and every tier is reachable by removal; the two cuts are E5's to refit.

### Why forcing chains test three candidates, not two

Tatham's forcing step is bivalue. With bivalue cells only, the 6×6 fixture stalled as
`'unrated'`: its bottleneck cells had three candidates. Widening the trial to cells with 2–3
candidates (fewest first, so a bivalue test is still tried before a trivalue one) finished it in
four chains. Still no guessing: a value is removed only when its supposition is *proved*
impossible; the alternatives are never assumed, which is what separates this from bifurcation
(rung 10, never shipped — D6).

### What the plan listed that is not here

`twoLineInteraction` (T4) was scoped to "what the corpus needs"; the three fixtures needed none
of it (line filtering plus the Latin links covered every step). E3's corpora decide whether it
earns a rung. Hidden triples are likewise absent until something needs them.

## The deduction loop

```text
step(cap, disabled, target):
    for each technique in ladder order, skipping tiers above cap and disabled ones:
        apply it; a contradiction → null; a step → return it
    nothing applied → null
    (with target set, EVERY placing technique — clueN, clue1, facingSum, clue2Pattern's placement,
     the Latin singles — fires only for that cell; eliminations still run anywhere. The hint
     explainer uses this so the selected cell is placed the moment the board makes it deducible,
     by whichever rule does it, never by a detour)

solve({ maxTier, disable, recordSteps }):
    while not contradicted and not solved:
        count the empty cells placeable as a single right now (opportunity density)
        step = step(maxTier, disabled); none → stop
        count the technique; keep the step if asked
    → { solved, contradiction, hardestTier, techniqueCounts, passes, avgOpenSingles, steps }
```

A player's grid can arrive **contradicted**: a placed height that repeats in its row or column
(checked explicitly in the constructor with a seen-mask per row and column — `stripFromPeers`
only touches empty cells, so a repeat would otherwise pass unnoticed until a house emptied), or
a filled prefix that already breaks its clue — judged by the board's own prefix rule
(`clueStatus`, G10), so the solver and the red clue always agree on what is provably wrong. No
step is recorded against such a grid.
Any later contradiction (a cell emptied of candidates, a height with no place, a line with no
surviving arrangement) stops the solve the same way; `classifySkyscrapers` reports such a puzzle
as `'unrated'` and the hint explainer returns `null`, never a step built on a mistake.

## `measureSkyscrapers(shape)`

```text
trivialClues   = clues equal to 1 or N (each resolves a cell or a line in one move)
facingSumPairs = facing clue pairs summing to N + 1 (each pins the tallest tower)
fixed          = cells placed by tier 1 alone
implied        = cells placed by tiers 1–2
rating         = mean candidates per empty cell after the tier-1–2 pass (1.0 = finished)
plus size, present and blank clue counts
```

On the served fixtures after the re-tier: 5×5 rating 1.0 (tiers 1–2 finish it: 25 implied of
25), 6×6 and 7×7 still give tiers 1–2 little — which is why they grade extreme.

## `classifySkyscrapers(shape, { metrics })`

```text
result = fresh solver.solve({ recordSteps: true })
metrics only when asked
not solved → { tier: null, difficulty: 'unrated' }
tier = hardestTier (0 → 1: a puzzle with nothing to deduce is still "easy")
→ { tier, difficulty: TIER_DIFFICULTY[tier], result, metrics }
```

Fixtures (pinned in tests): 5×5 **easy** (tier 1 — three small line scans; it graded hard under
the flat tier), 6×6 **extreme** (tier 5 — four forcing chains), 7×7 **extreme** (tier 5 — two
chains); classify 0.24 / 5.1 / 4.5 ms warm against the plan's 20 ms gate (per-line dirty scans
made the re-tiered solver faster than the flat one, 0.4 / 6.7 / 6.3). The line and house cell lists are built once in
the constructor (the E2 review's efficiency finding): the solve loop allocates none of them. The unit test only guards against a pathological
regression (< 1 s): a wall-clock assertion under the suite's parallel load measures the load.

## `explainSkyscrapersHint(shape, grid, { cap, preferCell })`

```text
solver on the player's grid; leadUp = []
loop (bounded by N³ + 1 — every step places or removes ≥ 1 candidate bit):
    no preferCell → step(cap)
    preferCell   → step(cap, target = preferCell)   (placers confined to that cell; eliminations free)
                   ?? step(cap)                      (nothing can place it yet → the ladder's next placement)
    none → null
    a placement → return { cell, digit, technique, tier, explanation, leadUp }
    an elimination → push its explanation onto leadUp and continue
```

**No detour** (Kakuro L13): the lead-up cites only eliminations, so every reason describes the
board as the player sees it, and the first placement returns. The selected cell is placed by
*whichever* rule can deduce it — under a clue of N, (3,1) is "3" by the clue-N climb without
(1,1) and (2,1) being placed first, since the climb knows every position at once — and only when
no rule can place it does the ladder place elsewhere, which is then the hint. That is why
`hint-deducers.ts` needs no Skyscrapers-specific precedence (the E2 review's altitude finding:
the first draft patched the selected-cell rule into the deducer with an exact-solver detour).

## Soundness

Every logical placement must equal the exact solution. The tests fuzz that on random uniquely
solvable 4×4 / 5×5 puzzles (a random Latin square, all clues, thinned while unique) and on the
three fixtures; the research's risk register names "plausible-but-wrong visibility rules" as the
AI failure mode this guards against. Each technique also has a minimal hand-built case that
fires it, and the empty unclued board is the shared must-not-fire case.
