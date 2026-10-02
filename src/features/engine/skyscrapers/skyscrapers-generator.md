# Skyscrapers generator (`skyscrapers-generator.ts`)

Plan slice **E4**: a Latin square, the repair that makes it unique, and the clue removal that
makes it a puzzle — three plain functions plus `generateUniqueSkyscrapers`, which chains them.
Every function takes an `rng`, so a seed reproduces a puzzle end to end (the Keisan lesson, kept
by Kakuro: thread it everywhere or "same seed → same puzzle" silently fails). The design is what
the yield spike measured ([skyscrapers-feasibility-findings.md](../../../../Docs/research/skyscrapers-feasibility-findings.md));
plan: [skyscrapers-implementation-plan.md](../../../../Docs/skyscrapers-implementation-plan.md).

## Why repair, not retry

A random Latin square is unique with all 4N clues 34% of the time at 5×5, 8% at 6×6 and
**never** at 7×7 (0 of 94,962 — G4). Fill-and-retry would never finish at the large size. A
random **intercalate swap** — find a 2×2 sub-square whose corners read `a b / b a` and swap its
rows' entries — keeps the square Latin and changes a handful of clues, so a hill-climb on the
*same* square, whose objective is the capped solution count of the clues it implies, converges
in milliseconds at 5×5 and 6×6 (L6). The pipeline is **fill → repair → remove → verify**, and
the fill only has to be Latin, not lucky.

## Fill — `randomLatinSquare(size, rng)`

`fillGrid` on the boxless config (`skyscrapersGridConfig`): the Sudoku engine's randomised
backtracking fill with no boxes, which is exactly a random Latin square.

## Repair — `repairToUnique(size, { countLimit, restartAfter, stepCap, msCap, start })`

```text
square = start ?? random Latin square;  count = solutions(all clues of square) capped at countLimit
while count ≠ 1 and under the caps:
    fruitless ≥ restartAfter → square = fresh random square, count recomputed, restarts += 1
    trial = square with one random intercalate swap (none possible → treat as a stall)
    next = capped count of trial
    next ≤ count → keep trial (a strict drop resets fruitless; a plateau move counts as fruitless)
    else            → fruitless += 1
→ { solution, solutions (1 when repaired), swaps, restarts, ms }
```

**Why plateau moves are kept:** a flat region between two counts is what the climb has to cross;
rejecting equal-count swaps strands it.

**Why the restart (L16):** the cap exists only to give the climb a gradient. A random 7×7 has
*more* than 20 solutions with all 28 clues, so every neighbour scores "20" and the climb wanders;
E3 measured the plain climb at **24/50** converging in 20 s, and a fresh square after 40 fruitless
swaps with the cap lowered to 20 at **30/30 in a median 178 ms** (max 722). Most of a square's
progress happens in its first 40 swaps or not at all. The defaults (`countLimit` 20,
`restartAfter` 40) are those numbers.

## Remove — `removeClues(solution, { targetTier, order })`

```text
clues = all 4N clues;  tier = classifier's tier of the all-clue puzzle
targetTier set and tier above it (or unrated) → return unchanged: no removal can bring it down (L17)
slots = the 4N clue positions, shuffled, then stably partitioned by `order`:
    trivialLast  (targets 1–2, default) — 1s and Ns go last: each resolves a cell in one move, so an easy puzzle keeps them
    trivialFirst (targets 3+, default)  — they go first: a hard puzzle sheds the free moves
    random       (no target, default)
for each slot: blank it;
    not unique (exact solver, limit 2)                 → restore
    targetTier set and ladder tier above it / unrated  → restore   (Tatham's bound)
no target → tier = classifier's tier of what came out
→ { clues, kept, tier, ms }
```

Removal only ever moves a puzzle **up** the ladder — fewer clues, more deduction — so the
fully clued square's own tier is the floor of anything removal can produce. That is why the
target check happens before any clue comes off, and why easy/medium yields depend on the ladder's
grading of the all-clue square (the E3 roadblock, fixed by the E3b re-tier).

**Re-add on overshoot** is the restore step: a removal that would push the puzzle past the target
is undone immediately rather than the square discarded, which is the yield lever Tatham's
generator lacks.

## `generateUniqueSkyscrapers({ gridSize, targetTier, maxRounds, timeBudgetMs, repair, order })`

```text
for each round while the budget lasts:
    repaired = repairToUnique(size, { …repair, msCap: min(repair.msCap, what is left) })
    not unique → next round
    removed  = removeClues(repaired.solution, { targetTier, order })
    target set and the square's floor was above it → next round
    exact verify (isSkyscrapersUnique) — the final word, after the removal's budgeted counts
    label = TIER_DIFFICULTY[tier]  ('unrated' only if the ladder cannot finish — impossible with a target)
    → { puzzle (grid all zeros — no givens, D3), stats }
budget or rounds out → null
```

`stats` (`rounds`, repair swaps/restarts/ms, removal kept/ms, total ms) is the production
counterpart of E3's measurements; the route logs it beside the request and the served label.

**With a target the puzzle may land *below* it** — a medium request can come back easy when the
removal order never needed a medium step. Serving exactly the requested tier is E5's job
(`generateSkyscrapers`), as it was Kakuro's: this slice exposes the knobs E5 biases with
(`targetTier`, `order`, the repair caps) and labels honestly.

## `tierOf(level)`

The ladder index plus one — `SKYSCRAPERS_LADDER` is in tier order. The route maps the requested
level to the removal's bound with it.

## Measured (E4, 2026-10-02, dev machine — the route's policy: bounded 40 rounds / 12 floor misses / 6 s, then unbounded 2 s)

| size | request | fails | fallbacks | ms med / mean / max | served |
|---|---|---|---|---|---|
| 5×5 | easy | 0/100 | 0 | 8 / 10 / 42 | easy 100 |
| 5×5 | medium | 0/100 | 0 | 7 / 7 / 27 | medium 61 · easy 39 |
| 5×5 | hard | 0/100 | 0 | 8 / 9 / 36 | hard 6 · medium 71 · easy 23 |
| 5×5 | expert | 0/100 | 0 | 7 / 8 / 21 | expert 10 · hard 7 · medium 56 · easy 27 |
| 5×5 | extreme | 0/100 | 0 | 7 / 9 / 70 | extreme 35 · expert 3 · hard 5 · medium 27 · easy 30 |
| 6×6 | easy | 0/100 | 3 | 39 / 51 / 210 | easy 97 · (fallback) extreme 2 · expert 1 |
| 6×6 | medium | 0/100 | 0 | 29 / 34 / 89 | medium 93 · easy 7 |
| 6×6 | hard | 0/100 | 0 | 30 / 35 / 99 | hard 46 · medium 52 · easy 2 |
| 6×6 | expert | 0/100 | 0 | 28 / 34 / 116 | expert 11 · hard 37 · medium 51 · easy 1 |
| 6×6 | extreme | 0/100 | 0 | 35 / 50 / 318 | extreme 64 · expert 4 · hard 17 · medium 15 |
| 7×7 | easy | 0/60 | **45** | **3,098 / 3,506 / 7,913** | easy 15 · (fallback) extreme 29 · hard 8 · unrated 7 · expert 1 |
| 7×7 | medium | 0/60 | 0 | 450 / 655 / 2,423 | medium 60 |
| 7×7 | hard | 0/60 | 0 | 324 / 402 / 1,756 | hard 58 · medium 2 |
| 7×7 | expert | 0/60 | 0 | 359 / 391 / 1,615 | expert 12 · hard 43 · medium 5 |
| 7×7 | extreme | 0/60 | 0 | 366 / 449 / 1,287 | extreme 52 · expert 2 · hard 4 · medium 2 |

**Unbounded** (no target, 100 per size): 5×5 6 ms median, 6×6 20 ms, 7×7 221 ms (mean 284,
max 1,168; restarts median 2) — 0 failures; served tiers bottom-heavy on extreme at 6×6 (60%)
and 7×7 (71%), with `unrated` 3 / 3 / 11% (unique puzzles the 200-step chain cannot finish).

**Reading it:** every size serves every request with **0 failures**; 6×6 is 30–50 ms mean against
the plan's 200 ms gate and 7×7 400–800 ms against 1 s — except **7×7 easy**, where three squares
in four have no easy floor, the bounded attempt burns its 12 floor misses (≈ 3 s) and the
fallback serves whatever comes (extreme, mostly). That is the per-size tier-set question E3
raised and E5 owns (does 7×7 offer easy at all?); the route's fallback keeps the request from
failing meanwhile. `kept` medians 7 / 11 / 14–15 of 4N, as E3 measured.
