# Kakuro (Cross Sums) — Implementation Plan

> **Status:** 📋 Planned (plan written 2026-09-11; nothing built) · **Branch:** fresh
> (`feature/kakuro`) · **Roadmap:** Phase 10 in [roadmap.md](roadmap.md)
> **Running log (decisions · gaps · bugs · learnings):** [kakuro-log.md](kakuro-log.md) — every
> `D#` / `G#` referenced below lives there with its current status.
> **Research:** [kakuro.md](research/kakuro.md) (the deep report this plan is built from) ·
> [keisan-9x9-honest-ladder.md](research/keisan-9x9-honest-ladder.md) (the bounded-recursion
> top-tier pattern this plan proposes to transplant) ·
> [keisan-9x9-feasibility-findings.md](research/keisan-9x9-feasibility-findings.md) (the de-risk
> pattern X0 copies) · [daily-redesign-plan.md](daily-redesign-plan.md) (how a new type registers
> into the daily) · [puzzle-grid-size-landscape.md](research/puzzle-grid-size-landscape.md)
> **Sibling plans (the shape this one copies):** [kenken-implementation-plan.md](kenken-implementation-plan.md),
> [killer-6x6-implementation-plan.md](killer-6x6-implementation-plan.md)

This is a **living handoff document** (AGENTS.md → Living Planning Docs). Each slice carries its
spec now and gains a **step-log** (process · learnings · blockers) when it lands. Cross-cutting
decisions, research gaps, bugs, and measurements go in the [running log](kakuro-log.md), not here,
so this doc stays a plan and the log stays a record.

## 1. What the research locks in (before any code)

Kakuro is a **genuine fourth puzzle type**, not a cage variant. There is no row, column, or box
constraint at all — the only constraints are, per *run* (a maximal horizontal or vertical strip of
white cells), **sum = clue** and **all-different**. Digits are always 1–9 regardless of grid size.
That single fact drives almost every divergence from the Killer/Keisan machinery below.

- **Naming.** Nikoli's two U.S. "KAKURO" word marks were abandoned in 2007 (failure to respond),
  so there is no live U.S. registration on the puzzle-type name; "Cross Sums" (Dell, 1966) is the
  fully generic fallback. Research recommends shipping as **"Kakuro (Cross Sums)"** pending a
  common-law / EU / JP counsel check → **D1**, gap **G1**.
- **Generation ≫ solving.** Finding-another-solution is ASP-complete (Yato–Seta 2003), so uniqueness
  verification is the expensive step. Naive random generation is *empirically hopeless* even at
  10×10 (Mathimagics' best random attempt still had 3,676 solutions). The only tractable shape is
  **solution-first**: symmetric black-cell layout → valid digit fill → derive clues → verify with a
  counting solver that early-terminates at the 2nd solution. **Black-cell density is the dominant
  statistical lever** for both uniqueness and difficulty.
- **Difficulty does not scale like Sudoku.** It rides run-length / combination-space structure,
  not clue count: a dense 6×6 can be fiendish, a 24×14 can be singles-only yet take hours. So tiers
  are calibrated **within** a grid size (the Keisan principle — already proven in this repo), and
  the label is assigned **from the technique classifier post-generation**; generator parameters
  only *bias* toward a tier → **D8**.
- **The combination table is tiny.** 2⁹−1 = 511 non-empty subsets of {1..9}; grouped by length the
  counts are 9, 36, 84, 126, 126, 84, 36, 9, 1. The whole `(length, sum) → {combos, union mask}`
  table is a build-time precompute. Régin-style GAC for all-different is *overkill*: the
  combination-mask method already gives per-run GAC at length ≤ 9.
- **Technique ladder (easiest → hardest):** unique combinations → intersection → naked/hidden
  singles → pairs/triples → min/max (sum-based) elimination → residual sums → limited-solution-set
  reasoning → **surface / disconnection sums** (the Kakuro analogue of innies/outies — there is no
  clean "45 rule") → locked candidates → chains / whips / g-whips (Berthier) → bounded T&E.
  Community consensus: fair puzzles are **logic-only**; T&E-requiring puzzles are curiosities.
- **Grid conventions.** Runs are length 2–9 (never 1). Every white cell is in both an across and a
  down run. The white region is connected. 180° rotational symmetry is the aesthetic norm.
  **Name puzzles by interior playable area** (a "9×9" has a 9×9 white-region bounding box; the dead
  clue row/column does not count) — some sites count it, which confuses users → **D2**.
- **Size guidance.** ≤ 5×5 is trivial (tutorial only). 6×6–7×7 supports Easy–Medium honestly;
  genuinely-hard 6×6 verges on T&E. **8×8–10×10 is the sweet spot** for a full ladder. Ship 4×4
  only as a tutorial, if at all → **D6**, gap **G6**.
- **Instrumentation that proves a tier** (Mathimagics + Berthier): white-cell count (NCELL), max
  run length (MRL), average cell run length (ACRL), black-cell density, run-length histogram,
  unique-combination run count (`fixed`), cells solved by iterated shaving (`implied`), post-shaving
  average possible-values-per-cell (`rating`), the ordered technique list, max technique level, and
  guess count (must be 0 at tiers ≤ hard).

## 2. What we already have (reuse map)

Surveyed 2026-09-11 against `main` (`99b87ee`). "Reuse" means import or copy the pattern; "new"
means Kakuro needs its own.

| Area | Existing | Kakuro | Notes |
|---|---|---|---|
| Sum-combination table | `killer/cage-combinations.ts` — `combosFor(size, sum, maxDigit)`, `candidateMaskFor`, `guaranteedMaskFor`, `candidateMaskExcluding` (distinct digits, memoized) | **Reuse candidate** | This *is* the Kakuro `(length, sum)` table at `maxDigit = 9`. X1 verifies coverage for lengths 2–9 and either re-exports or wraps it; do not write a second table. |
| Exact solver | `killer-solver.ts` / `calc-solver.ts` (bitmask + MRV + node budget) | **New** (`kakuro-solver.ts`) | No row/col masks exist in Kakuro — the pruning unit is the run, not the house. Copy the MRV + node-budget + early-exit-at-2 *shape*, not the code. |
| Logical solver + grading | `KillerLogicalSolver`, `CalcLogicalSolver` (tiered techniques, `SolveResult` with technique histogram), `scoreKillerSolve` / `scoreCalcSolve` two-factor scorers | **New** solver, **reuse** the scorer pattern | Technique names differ entirely; the *result shape* (tier, techniques[], steps, guess count) and the Stuart-style weighted-sum × opportunity-density scorer transfer. |
| Bounded-recursion top tier | `CalcLogicalSolver` T5/T6 (depth-1 Nishio; guess-step count as a monotone axis — K7b–K7d) | **Transplant** (proposed) | See **D5**. Cheapest honest Expert/Extreme; the research's chain/whip classifier is the alternative. |
| Layout / fill generator | `cage-generator.ts` region growing; `grid-utils.fillGrid` | **New** (`kakuro-layout.ts`, fill inside `kakuro-generator.ts`) | Cage growing is the wrong primitive; Kakuro needs a symmetric black-cell template generator plus a run-all-different DFS fill. |
| Generate-and-grade pipeline | `generateKillerSudoku` / `generateCalcSudoku`: fill → constrain → reject non-unique → grade → band → accept | **Copy the shape** (`kakuro.ts` → `generateKakuro`) | Including the K-lesson "grade before uniqueness when deductions are sound" — check whether it applies (sound completion ⇒ unique). |
| Benchmarks | `benchmark-calc.ts` + `benchmark-log.appendBenchmarkRows` | **Reuse** (`benchmark-kakuro.ts`) | Randomized inputs, one row per tier, appended to `benchmark-logs.md`. |
| Board store | `useBoardStore`: `PuzzleVariant`, `BoardPuzzle` union, `BoardCage {id, cells, label}`, `cellToCage`, `computePeers` (row/col/box), Killer-gated pencil stripping | **Extend** | `'kakuro'` joins the union. Peers become **run-mates** (a new peers builder — `computePeers` is house-based and wrong here). Pencil stripping on placement is *correct* for Kakuro (no repeats in a run) — gate it on `variant === 'kakuro'` alongside Killer. |
| Board rendering | `Board.tsx` / `Cell.tsx` (`hasBoxes` gate, givens, peer/cage highlight), `CageOverlay` | **Extend + new** | Kakuro has no cage outlines and no givens; it has **blocked cells** (black) carrying up to two clues, and a clue **gutter** for edge runs (D2). New: a clue-cell renderer; blocked cells are non-selectable and skipped by keyboard navigation. |
| Numpad | `Numpad.tsx` — digits `1..config.size`, "all placed" from `config.size` | **Change** | Kakuro digits are 1–9 at every size. Drive the numpad from `config.maxNum` (already on `GridConfig`) and set a Kakuro config `{ size: N, hasBoxes: false, maxNum: 9 }`. The "digit exhausted" counter has no meaning in Kakuro — disable per variant. |
| Solved check | `nextGrid.every(... v === solution[r][c])` | **Free** | Cell-for-cell match; with black cells encoded identically in grid and solution (D3) it needs no change. |
| Rules dialog | `RulesDialog.tsx` — `VARIANT_TITLE` + `RulesBody` per variant, `hasSeenRules(variant)` | **Extend** | One new body; the "Cross Sums" subtitle and the interior-size convention belong here. |
| Save / resume | `useSavedGame` persists `variant` + puzzle | **Extend** | Serialized puzzle gains `runs`; round-trip test. |
| PDF | `pdf.service.ts` — `drawGrid`, `drawCagedGrid` (Killer/Keisan), `generateKillerPDF`/`generateCalcPDF`, shared nav helpers (bookmarks + puzzle↔answer links) | **New renderer, reuse nav** | `drawKakuroGrid` (black cells, diagonal clue split, gutter) + `generateKakuroPDF`. |
| APIs | `/api/puzzle` + `/api/generate` switch on `variant` | **Extend** | One more branch each; Zod validation of sizes per variant. |
| Hub | `PuzzleHub.tsx` — `PuzzleCard` with `href` (live) or without (coming soon); `new!` sticker convention | **Extend** | A Kakuro card; sticker moves off Keisan ("newest thing wears new!"). |
| Daily registry | `daily-row.ts`: `Variant`, `VARIANTS`, `PROFILE[(variant,size,difficulty)]`, `isEligible`, `rollDailyAssignment` (standard: `VARIANTS.length` distinct rungs; minis: `PERMS_3` over exactly 3 slots), `MINI_KEYS` (3 keys) | **Extend + generalize** | The 4th type trips the plan's own "open scaling question": 3 mini slots vs 4 types → **D4**. `schema.ts` `variant` is a `text` column with a `$type` union — **no migration** to widen. |
| Daily storage | `daily_puzzles.cages` (untyped jsonb; `StoredCage` = Killer `{cells,sum}` \| Keisan `{cells,op,target}`) | **Reuse** | A Kakuro run is structurally a Killer cage: `{ id, cells, sum }`. Store runs in `cages`; the row's `variant` says how to read them. No migration (same trick Keisan used). |
| Daily surfaces | `dailies.service.ts` dispatch, `/api/daily` serve, `useDaily`, `slot-display.VARIANT_LABEL`, picker + leaderboard tabs, `seed.ts` | **Extend** | One label, one dispatch branch, one hook branch. |
| Anti-cheat | `gridsMatch`, `isImplausiblyFast` via `PROFILE` floors, `(key, variant, size)`-scoped bests | **Free + tune** | Floors/bot times for every eligible Kakuro combo → **G2**. |
| Hint agent (MCP over `HumanSolver`) | Classic only | **Non-goal** | Recorded so it isn't rediscovered as "just add a variant". |
| E2E | `e2e/play.spec.ts` per-variant specs | **Extend** | One Kakuro play spec (blocked cells, clue render, 1–9 numpad at 6×6, board starts empty). |

## 3. Locked and proposed decisions (summary — details and status in the log)

| # | Decision | Status |
|---|---|---|
| D1 | Display **Kakuro**, subtitle **Cross Sums**; engine/slug `kakuro` (slug-vs-display split is allowed to stay if counsel forces a rename — the `calc`/Keisan precedent) | Proposed; blocked on G1 for the *display* name only |
| D2 | **Interior N×N storage + explicit runs list**; clue cells render in a one-cell gutter (top + left) plus inside interior black cells. `grid.length === N` stays true everywhere (`DailySize`, profile lookup, board config) | Proposed — confirm |
| D3 | Black cells are `0` in both `grid` and `solution`; **blocked = "in no run"**, derived from `runs` at game start (like `cellToCage`). No `-1` sentinel leaks into `Grid` consumers | Proposed — confirm at X1 |
| D4 | Daily at 4 types: **keep 3 mini slots and roll 3 of the 4 types** each day; Kakuro minis are **6×6 only**; the "easy/medium = 4×4" size rule becomes per-type (a type's minimum mini size wins) | Open — owner |
| D5 | Top tiers: T1–T4 by technique ladder; **T5 = bounded depth-1 recursion, guess-step count as the Extreme axis** (Keisan K7b–K7d transplant), with the same honest copy. Berthier chains/whips deferred | Proposed — confirm; see G5 |
| D6 | v1 sizes: **6×6 and 9×9 interior** (what the daily needs). 8×8 / 10×10 / 12×12 later; no 4×4 | Proposed |
| D7 | Roadmap: **Phase 10**, engine-first like Phase 6/8 | Applied (this PR) |
| D8 | Difficulty label comes from the classifier **post-generation**; generator parameters only bias | Locked (research) |
| D9 | Shipped layouts are **180° rotationally symmetric**, white-connected, runs 2–9, no degenerate sub-blocks (aligned length-9 pairs, 5×5 all-white, 2×9 / 3×8 / 4×7 blocks) | Locked (research) |
| D10 | **No T&E at tiers ≤ hard** (guess count must be 0). Expert/Extreme state their guarantee in copy exactly as Keisan does | Locked |

## 4. Slices

Each slice is its own PR gated by the AGENTS.md Pre-Merge / Pre-PR Checklist. Spec and step-log
live together under each slice. Status key: ✅ done · 🚧 in progress · ⏳ not started · ⏸ deferred.
Engine module: `src/features/engine/kakuro/` with mirrored `.md` files per source file.

### X0 — De-risk measurement (throwaway spike, no production code) ⏳

The research's one hard warning is about **our** generation yield, and the K7 lesson is that a
plan built on an unmeasured assumption gets re-sliced later at higher cost. Before X1, spend a
bounded session measuring, on a throwaway script under the scratchpad (not committed to `src/`):

- A hand-written symmetric layout for 6×6 and 9×9 interior (edges-inward rules, D9) + a
  randomized run-all-different fill + clue derivation + a naive propagating counting solver.
- Measure over ≥ 200 fills per size: **P(unique)**, verify time per candidate, wall-clock per
  accepted puzzle, black-cell density, and the Mathimagics `fixed` / `implied` / `rating` numbers
  of the accepted puzzles.
- Try two densities per size (research: density is the dominant lever) to see the yield curve.

**Output:** `Docs/research/kakuro-feasibility-findings.md` (the K7 pattern) and log entries under
Measurements. **Gate:** a unique 9×9 in **< 1 s average** with naive templates, and a 6×6 in
< 200 ms. If either fails, **stop and re-slice** — likely toward a curated template library and
structural pre-checks (G3, G10) before X3, rather than tuning inside X3.

### X1 — Types + combination table + layout model ⏳

- `kakuro-types.ts`: `KakuroPuzzle { variant: 'kakuro'; gridSize; grid; solution; runs; difficulty; layout? }`,
  `Run { id; cells: number[]; sum; dir: 'across' | 'down' }` (flat `row * size + col` indices, the
  Killer/Keisan convention), difficulty union `easy | medium | hard | expert | extreme`.
- Combination table: verify `cage-combinations.ts` at `maxDigit = 9` gives exact `(length, sum)`
  coverage for L 2–9 (sum ranges 3–17, 6–24, 10–30, 15–35, 21–39, 28–42, 36–44, 45); wrap as
  `kakuro-combinations.ts` (union mask, per-combination masks, `isUniqueCombination(L, S)`), or
  re-export. Tests assert the 9/36/84/126/126/84/36/9/1 counts and the canonical magic entries
  (3-in-2 = {1,2}, 4-in-2 = {1,3}, 16-in-2 = {7,9}, 17-in-2 = {8,9}, 6-in-3, 7-in-3, 23-in-3,
  24-in-3, 10-in-4, 30-in-4, 45-in-9).
- `derivesRuns(layout)`: from a boolean black mask to the runs list; validates D9 invariants
  (no length-1 runs, every white in two runs, connectivity, degenerate-block check).
- Mirrored `.md` for each file; D2/D3 encoded in the types' JSDoc with the "why".

**Gate:** table tests exact; runs derivation fuzzed against a brute-force strip scanner.

### X2 — Exact solver + uniqueness counter ⏳

- `kakuro-solver.ts`: 9-bit candidate masks per white cell; **per-run propagation** (filter the
  run's surviving combinations against current cell masks → union → AND into each cell; singleton
  cascade removes the digit from run-mates in *both* runs), plus min/max residual bounds; MRV DFS
  with a **node budget** and **early exit at the 2nd solution**. Monomorphic hot path (AGENTS.md
  §5) — one solver class, typed arrays, no per-call allocation in propagation.
- No Régin GAC (research: overkill at L ≤ 9).
- Optional if X0 says verification is the bottleneck: Mathimagics' look-ahead (test all values of a
  cell; a value forced in every branch is forced).
- Tests: fuzz vs an independent brute force on tiny layouts (≤ 4×4 interior), the known
  non-unique degenerate blocks report ≥ 2 solutions, budget exhaustion is reported, not silent.

**Gate:** uniqueness verify on X0-shaped 9×9 candidates **< 50 ms average** (the Keisan/Killer
gate), fuzz clean.

### X3 — Layout generator + digit fill + clue derivation ⏳

- `kakuro-layout.ts`: the **edges-inward template method** — generate a valid symmetric outer
  edge, force inward neighbours white (no orphan 1-cell runs), fill the interior with a symmetric
  pattern; odd sizes use the self-symmetric centre line. Enforce D9. Expose density and
  run-length-mix knobs (the difficulty levers X5 biases with). Consider a small **curated template
  library per size** as a fallback/accelerator (G3).
- Fill: randomized DFS with per-run all-different; derive every run's sum. Reject fills whose
  layout hits a known non-unique structure *before* calling the counter (G10).
- `generateUniqueKakuro(size, layoutOpts)` loop: layout → fill → derive → verify → accept/retry.
  Measure yield per density band and record it in the log.

**Gate:** yield ≥ what X0 measured; 9×9 accepted puzzle < 1 s avg at medium density; 6×6 < 200 ms.

### X4 — Logical solver (technique classifier) + instrumentation ⏳

- `kakuro-logical-solver.ts` (a class, no inheritance — AGENTS.md §1), tiered:
  - **T1** unique combinations + intersection (cross-referencing across/down unions).
  - **T2** naked/hidden singles + residual-sum re-lookup.
  - **T3** naked/hidden pairs/triples within a run + min/max (sum-based) elimination +
    limited-solution-set reasoning.
  - **T4** locked candidates across runs + **surface / disconnection sums** (region sum
    bookkeeping; a cut cell whose removal disconnects a region gives its value) — algorithm to be
    pinned down (G4).
  - **T5** per D5: bounded depth-1 recursion with guess-step counting (transplant
    `CalcLogicalSolver`'s snapshot/contradiction shape), or Berthier chains if D5 flips.
- `KakuroSolveResult { tier; techniques[]; steps; guessSteps; metrics }` where `metrics` carries the
  research's instrumentation set (NCELL, MRL, ACRL, density, run-length histogram, unique-combo
  count, fixed, implied, rating).
- `kakuro-score.ts`: two-factor scorer (weighted technique sum × opportunity density), weights
  seeded from the ladder order; re-fit in X5.
- **Soundness fuzz:** every logical placement must match the exact solution — zero mismatches.

**Gate:** soundness fuzz clean over ≥ 500 generated puzzles per size; tier distribution reported.

### X5 — Difficulty configs + `generateKakuro(difficulty, { gridSize })` + benchmark ⏳

- `kakuro.ts`: per-size `DIFFICULTY_CONFIG` — layout bias (density, run-length mix, unique-combo
  share targets from the research's T1–T5 table, treated as **starting points**), solver cap +
  necessity (`minTier`, as Killer/Keisan do), score bands from **measured** per-size
  distributions (recalibration protocol: never reuse cuts across sizes).
- Pipeline: bias layout → fill → derive → **verify unique** → grade → band → accept; reject
  non-unique, guess count > 0 at tiers ≤ hard, and below-tier boards.
- `benchmark-kakuro.ts` + `benchmark-logs.md` rows; targets set from X0/X3 reality and logged.
- 6×6 ships whatever tiers **measure** as honestly separable (research expects Easy–Medium;
  Hard is the open question G6) — the Killer-4×4-easy-only precedent.

**Gate:** bands disjoint per size; easy/medium/hard 9×9 < 500 ms avg; expert/extreme allowed to
be cron-only slow (Killer-extreme precedent, `maxDuration`), 0 generation failures in 20 per tier.

### X6 — Surfaces: board, PDF, hub, APIs ⏳

- **Real discriminant first** (the Keisan K5 audit lesson): `PuzzleVariant` / `BoardPuzzle` /
  `usePuzzle` / `DifficultyConfigurator` / `PuzzleForm` / `usePuzzleGeneration` unions gain
  `'kakuro'`; `startNewGame` switches on `variant`, never on `'runs' in puzzle`.
- **Board:** Kakuro config `{ size, hasBoxes: false, maxNum: 9 }`; `blocked` mask + `cellToRuns`
  built at game start; run-based peers builder; clue rendering (gutter + interior black cells with
  the diagonal across/down split); blocked cells unselectable and skipped by arrow-key nav;
  numpad reads `config.maxNum`; pencil stripping gated on `'kakuro'`; rules dialog body;
  `?variant=kakuro` deep link; `useSavedGame` round-trips `runs`; both themes; WAI-ARIA grid
  semantics for clue cells (G7).
- **PDF:** `drawKakuroGrid` + `generateKakuroPDF` on the shared nav helpers; `/api/generate`
  branch; PuzzleForm section (sizes per D6); sample booklet regenerated.
- **Hub:** live Kakuro card (`/play?variant=kakuro`, subtitle "Cross Sums"); `new!` moves off
  Keisan.
- **APIs:** `/api/puzzle` branch + Zod size validation per variant.
- **E2E:** Kakuro play spec; a11y spec covers the clue cells.

**Gate:** full battery + in-browser visual check handed to the owner (both themes, both sizes).

### X7 — Daily rotation (4 types) ⏳

- `Variant` → `'classic' | 'killer' | 'calc' | 'kakuro'` in `daily-row.ts` and the `schema.ts`
  `$type` (**no migration** — `text` column). `StoredCage` union gains the run shape.
- `PROFILE`: every eligible Kakuro `(size, difficulty)` gets floors + bot times (G2); the
  `isEligible ⟺ getProfile` coverage test stays the tripwire.
- `rollDailyAssignment`: standard draws `VARIANTS.length` = 4 distinct rungs of 5 (a 4-injection —
  every type must cover all five 9×9 rungs, which X5 must deliver, or standard eligibility
  becomes per-type too); minis per **D4** (replace `PERMS_3` with a "choose 3 of N types, then
  permute" enumeration filtered by `isEligible`, and let a type's minimum mini size override the
  4×4 default).
- `dailies.service` dispatch, `/api/daily` serve, `useDaily`, `slot-display` label ("Hard ·
  Kakuro", "Medium 6×6 · Kakuro"), picker + leaderboard tabs, `seed.ts` expectations.
- Verify with the plan's end-to-end checklist: exactly 3 + 3 rows/day, non-null variants, Kakuro
  appears in both sections over a seeded multi-day roll, archive/replay of old days unaffected.

**Gate:** roller property test (every day valid under `isEligible`, keys distinct, Kakuro reachable
in both sections); floors present for every rolled combo; live `db:seed` round-trip.

### Deferred / follow-ons (not v1)

- Larger sizes (8×8, 10×10, 12×12; 13×17 "big puzzle" mode) — `GridSize` widening must stay
  per-variant-gated (Keisan Risk 6).
- Berthier chains/whips as a real T5 if D5's transplant proves dishonest (G5).
- A combination-reference helper in the board UI (G12) — an assist policy question first.
- Hint agent coverage; Strategy-course lessons for Kakuro techniques (Phase 7 hook).
- Simonis-style clue *erasure* (removing redundant clues while unique) as a difficulty lever —
  changes the "every run is clued" rule and the UI; research it before adopting.

## 5. Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Generation yield collapses at 9×9 (the research's headline warning) | X0 measures *before* X1; density + template library + structural pre-checks are the levers; re-slice early, not inside X3 |
| 2 | Uniqueness verification too slow for the cron's `maxDuration` at expert/extreme | Node budget + early exit at 2; Killer-extreme precedent already tolerates ~5.5 s cron-only tiers; look-ahead propagation as the optional booster |
| 3 | Surface-sum technique mis-implemented (plausible-but-wrong — the AI failure mode) | Soundness fuzz vs exact solutions on every logical placement; T4 necessity gate proves the technique actually fires |
| 4 | Board assumes every cell is playable (selection, arrow nav, "all digits placed" counter, peers) | `blocked` mask threaded through Cell/Board/Numpad; run-based peers builder; E2E asserts a blocked cell cannot take a digit |
| 5 | Numpad and "exhausted digit" logic keyed on `config.size` | Drive from `config.maxNum`; disable the exhausted counter for Kakuro (no per-digit global count exists) |
| 6 | The daily roller hardcodes 3 minis (`PERMS_3`, `MINI_KEYS`) and assumes all types cover 9×9 | D4 + the generalized enumeration in X7; the coverage test and a roller property test are the tripwires |
| 7 | 6×6 "hard" is not honestly separable from medium without T&E | Ship the tiers that measure separable (Killer-4×4-easy-only precedent); eligibility follows measurement |
| 8 | Expert/Extreme via bounded T&E contradicts the community's "logic-only" fairness norm | Honest copy (Keisan precedent) + G5 to check what commercial hardest tiers actually require; chains remain the upgrade path |
| 9 | "N×N" naming ambiguity confuses players and floors (interior vs counted border) | D2 fixes interior naming; rules dialog says so; `grid.length` stays the interior size |
| 10 | Duck-typing `'runs' in puzzle` creeps in and misclassifies | Real `variant` discriminant landed at the top of X6 (K5 lesson) |
| 11 | Trademark surprise on the display name | Slug `kakuro` is internal; display name is one constant (`VARIANT_TITLE`, hub card, labels) — renameable without churn |
| 12 | Anti-cheat floors guessed too low/high with no in-repo prior | G2 — external solve-time baselines; conservative floors first, tune from real attempts |
| 13 | Storing runs in `cages` jsonb tempts cage-style rendering/pencil logic to run on Kakuro rows | `variant` gates every reader (already the Keisan rule); a test that a Kakuro row never renders a `CageOverlay` |

## 6. Definition of done (v1)

6×6 + 9×9 Kakuro: unique, symmetric, logic-only at tiers ≤ hard, difficulty-banded on measured
per-size cuts with the classifier as the label source; playable on `/play` with blocked cells,
clue rendering, 1–9 numpad, run-based peers/stripping, save/resume; printable; on the hub; in the
daily as the fourth type per D4; profile floors + bot times for every eligible combo; full test
battery + E2E green; benchmarks logged; mirrored docs synced; roadmap + README flipped; the
running log's open decisions resolved or explicitly deferred with a reason.
