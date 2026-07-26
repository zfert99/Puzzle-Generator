# Keisan — Feature Walkthrough

> **What this is:** the running build log for the Keisan puzzle type (Phase 8), one section
> per slice as it lands. The forward-looking design lives in the
> [implementation plan](kenken-implementation-plan.md); this doc records *what was actually built*
> and the judgment calls made along the way. Append a new section as each slice (K2…) ships.
>
> **Status:** 🚧 In Progress — engine K0–K4 ✅ · surfaces K5 core ✅ (play/PDF/hub) · difficulty
> rebalance ✅ · **next:** No-Op / Mystery mode (K6), then 9×9 + 5-tier (K7), plus the K5 daily-rotation
> tail · **Branch:** `feature/kenken`

## Naming

The puzzle is displayed as **Keisan** (Japanese 計算, "calculation"). In menus it appears as
**"Keisan"**, alongside **"Classic"** (Sudoku) and **"Killer"** (Killer Sudoku); the hub card
carries a descriptive subtitle (e.g. *"calculation-cage puzzles — Latin squares where the math is
the clue"*) so a new player knows what it is without the name having to explain itself.

**Slug vs. display is a deliberate split:** the engine module, all symbols (`Calc*`/`calc*`), and
the board `variant` slug stay the descriptive **`calc`** — only the *display name* is "Keisan".
Kept this way to avoid a churny rename; the mismatch is intentional. "KenKen" is a trademark of
KenKen Puzzle LLC and is avoided in shipping code/UI; "Calcudoku"/"Mathdoku" are the generic names
the puzzle is also known by.

## What Keisan is

An N×N **Latin square** — 1..N once per row and column, **no boxes** — partitioned into cages,
each showing a target and an arithmetic operator (`+ − × ÷`). No given digits; the arithmetic is
the clue. The defining divergence from Killer Sudoku: a digit **may repeat within a cage** as long
as the repeats don't share a row/column. Sizes 4×4 + 6×6 ship first, with the boxless prime sizes
5×5/7×7 as the differentiator vs. Killer (added in a later slice).

---

## K0 — Boxless-grid foundation ✅

Pure enabling refactor so the later slices build on a size-open, box-optional base. No Keisan
gameplay. It exists because a codebase audit found `GridSize = 4|6|9` was a **closed union** and box
assumptions leaked far outside the engine (both grid renderers, the board store's peer/border
logic). 5×5/7×7 — Keisan's differentiator — is therefore a type/engine/renderer change, not a
module-local one.

### Engine / types (K0)

- **`GridSize` widened `4|6|9` → `4|5|6|7|9`** ([sudoku.ts](../src/features/engine/sudoku.ts)). 5/7
  are *boxless* (prime → no rectangular box tiling — the structural reason box-Sudoku can't offer
  them and Keisan can).
- **`GridConfig` gained `hasBoxes: boolean`.** `getGridConfig` returns `hasBoxes: false` for 5/7
  with a **row-strip box sentinel** (`boxWidth = size`, `boxHeight = 1`) so any code reading the box
  dims without checking `hasBoxes` degenerates the box constraint to the row constraint it already
  enforces — harmless, never corrupting a Latin square. Real box consumers branch on `hasBoxes`.
- **`isValid` short-circuits after the row/column scan when `!hasBoxes`**
  ([grid-utils.ts](../src/features/engine/grid-utils.ts)).
- **`fillGrid` needs no change** — the sentinel makes `boxOf(r, c)` collapse to `r`, so `boxMask[r]`
  mirrors `rowMask[r]` and the box term is a redundant no-op. Deliberately **no branch added to the
  hot loop** (AGENTS.md §3). The K0 Latin-square test at 5/7 guards the sentinel.
- **`applyQuotaDigger`'s quota map is now `Partial<Record<GridSize, …>>`**
  ([diggers.ts](../src/features/engine/diggers.ts)) — no fake quotas for classic puzzles that can't
  exist at 5/7.
- **`HumanSolver` throws on any size other than 4/6/9** ([human-solver.ts](../src/features/engine/human-solver.ts)).
  The old catch-all `else` silently assumed 3×3 boxes; that would quietly mis-solve a boxless grid.
  HumanSolver is box-Sudoku-only; Keisan writes its own row/col techniques and never routes
  through it, so an unsupported size is now a loud programming error.

### Renderers, gated on `hasBoxes` (K0)

- **Board `Cell.tsx`** — box-peer highlight and thick box-border flags gated on `config.hasBoxes`.
- **PDF `drawGrid` + `drawKillerGrid`** — box-boundary thick lines only when `hasBoxes`; boxless
  grids get a heavier outer frame and thin interior lines. `drawKillerGrid`'s boxless branch is
  dormant today (Killer is always 6/9) and exists for the Keisan K5 PDF reuse.

### Persistence (K0)

- **Board store `persist` version bumped 2 → 3** — a persisted pre-K0 `config` lacks `hasBoxes` and
  would rehydrate falsy → phantom boxless rendering on a 4/6/9 board. Saved games are ephemeral, so
  the existing discard-on-mismatch `migrate` drops the stale shape cleanly.

### Judgment calls (K0)

- **`fillGrid` box-conditionalization pulled forward from K2 into K0** — the sentinel makes it
  correct with zero hot-loop change, so doing it here (with a guarding test) makes K0's foundation
  testable rather than speculative, at no perf cost.
- **The scattered `4|6|9` literal unions were left narrow on purpose** — GridSizeSelector,
  Play/PuzzleForm state, and the two API `VALID_GRID_SIZES` allowlists are independent narrower
  unions; widening `GridSize` doesn't break them, and they *should* stay `4|6|9` because
  classic/Killer don't support 5/7 and Keisan's UI isn't wired yet. 5/7 is *representable*, not
  *offered*, until the surfaces slice (K5).

### Verification (K0)

Typecheck / lint / markdownlint clean · **248 tests** (239 + 9 new) · benchmark Basic **0.11 ms** /
Advanced **0.18 ms** at historical best (no hot-path branch added).

---

## K1 — Multiset cage-combination tables + operator model ✅

The arithmetic foundation the solver/generator prune against. New module
[`src/features/engine/calc/`](../src/features/engine/calc/); nothing calls it yet.

### Operator model — [`calc-types.ts`](../src/features/engine/calc/calc-types.ts)

- **`CalcOperator = 'add' | 'sub' | 'mul' | 'div'`** (named, not symbol-keyed, so `'div'` never
  collides with `/`) + `OPERATOR_SYMBOL` display glyphs (`+ − × ÷`). No-Op / "Mystery" mode is a
  deferred later slice, so it is deliberately absent.
- **`computeTarget(op, digits)`** — sum / product / larger−smaller / larger÷smaller; throws if
  `sub`/`div` gets anything but two digits (a caller assigned a two-cell-only operator to a
  wrong-size cage).
- **`operatorAllowedForCageSize`** — `sub`/`div` two-cell-only; single-cell cages are givens (no
  operator). **`hasAssignableOperator`** — the **K2 legality invariant**: any 3+-cell cage needs
  `add` or `mul` in the active set, or generation silently wedges (a "sub-only" set is
  unsatisfiable for big cages).
- **`CalcCage`** — `{ id, op, target, cells }`, flat-index cells like Killer's `Cage`.

### Combination tables — [`calc-combinations.ts`](../src/features/engine/calc/calc-combinations.ts)

- **Per-`(op, size, target, N)` multiset enumerator** — repeats allowed (the defining Keisan
  divergence), each a pruned non-decreasing walk per operator. `sub`/`div` empty for any size ≠ 2 by
  construction; `1÷` correctly empty (a two-cell cage is always collinear, so can't hold the
  `{k, k}` repeat it would require).
- **`calcUnionMask` / `calcGuaranteedMask`** + `calcCombosFor`, lazily memoized by
  `(N, op, size, target)`. Lazy (not eager like Killer) because `×` targets are sparse over a huge
  range (up to `N^size`; 9! = 362 880 for a full-line product) — a dense table would be mostly
  empty. All products stay inside JS's safe-integer range, so no overflow handling.

### The two-layer check (K1's core design point)

Made explicit in code + docs per the external review. The tables are **layer one: arithmetic
validity** only — they don't know cage geometry. **Layer two: geometric placement legality** is the
solver's job (K2): a straight line/domino cage can hold NO repeats; only L/T/blocky shapes can. So
the tables **over-approximate**, and the masks are **priors, never exact for a cage shape**:

- `calcUnionMask` — **upper** bound (geometry only removes multisets → true set is a subset); safe
  for candidate pruning, over-counts for line cages.
- `calcGuaranteedMask` — **lower** bound (removing multisets can only make a digit *more*
  guaranteed); safe for elimination.

### Verification (K1)

27 tests including the published `6×` 4-cell → `{1,1,1,6}`/`{1,1,2,3}` gate, `{2,2}` repeat
multisets, the two-cell restriction, and memo/freeze behaviour. Full suite **275 green**; typecheck
/ lint / markdownlint clean.

---

## K2 — Exact solver + Latin-square generator ✅

The exact solver + the ungraded unique-puzzle generator. New files
[`calc-solver.ts`](../src/features/engine/calc/calc-solver.ts) and
[`calc-generator.ts`](../src/features/engine/calc/calc-generator.ts).

### The exact solver — `calc-solver.ts`

- **Bitmask/MRV over rows + columns only** — no box mask (Keisan is Latin-square-only). Node-budgeted
  `countSolutions(limit, budget)` returning `-1` on exhaustion (safe reject), mirroring the Killer
  solver's uniqueness API.
- **The geometric layer is free (key simplification).** K1's two-layer check said the solver must
  enforce "same-row/col repeats are illegal." But that *is* the Latin-square rule — two cage cells in
  the same row already can't share a digit via the row/col masks. So the cage layer only enforces
  **arithmetic**: each cage precompiles its valid multisets (K1) to per-digit count arrays and tracks
  a `cageMask` of digits that can still extend the placed multiset toward a valid one. A cell's
  candidates are `rowColFree & cageMask`. Because a placement is only admitted while it keeps the
  placed multiset a sub-multiset of a valid one, a full cage necessarily equals a valid multiset — no
  end-of-cage check needed.
- This cage pruning is **mandatory** (boxless = 2 units/cell, not 3, so the search would balloon
  without it).

### The generator — `calc-generator.ts`

- **`calcGridConfig(size)`** — always boxless, even at 4/6, so `fillGrid` (K0) yields a pure random
  Latin square rather than a box-Sudoku solution.
- **`generateCalcCageShapes`** — region growing with **no no-repeat stop** (repeats are legal), so
  growth terminates on the drawn target size / boxing-in; `maxSize` cap + the uniqueness gate are the
  quality backstops. `minSize`/`maxSize`/`maxSizeBias` levers carry over.
- **`assignCalcCages`** — single-cell cages are givens (`op:'add'`, `target:digit`); multi-cell cages
  pick a random operator legal for the size, with `div` also requiring an integer quotient. Returns
  `null` for an un-cluable cage so the loop retries; asserts the K1 legality invariant up front.
- **`generateUniqueCalc`** — fill → cage → assign → `countSolutions === 1`, else retry. Returns
  `{ cages, solution, gridSize }` (the full `CalcPuzzle` type + difficulty grading are K3/K4).

### Verification (K2)

12 tests incl. an **independent brute-force uniqueness counter** fuzzed against the solver on 4×4,
repeat-holding L-cages, node-budget exhaustion, cage-termination (not all `maxSize`), and the
operator-legality throw. Full suite **287 green**. **Gate met:** 6×6 QuadOp uniqueness-verify
**avg 0.038 ms** (budget < 50 ms), p95 0.1 ms, 57.7% unique yield — the mandatory cage pruning holds
up.

---

## K3 — Logical solver + difficulty tiers ✅

The human-style solver that grades a puzzle by hardest-required technique. New file
[`calc-logical-solver.ts`](../src/features/engine/calc/calc-logical-solver.ts).

- **Its own candidate grid + techniques** — it does NOT compose `HumanSolver` (box-Sudoku-only;
  throws on 5/7 per the K0 guard). Every technique scans rows and columns only, no box units.
- **Tier ladder:** T1 = cage arithmetic + naked/hidden singles (single-cell cages placed as givens
  at construction); T2 = naked/hidden pairs + **cage-combo restriction** (enumerate valid multisets,
  try to fully place each into the empty cells via candidates respecting no-collinear-repeat, keep
  only digits some placement supports); T3 = line-sum invariant (Rule of 21 — a line with one empty
  cell is forced); T4 = X-Wing on rows/columns.
- **Solve loop** applies the cheapest technique that progresses and restarts from the cheapest, so
  `hardestTier` is the minimum ceiling the puzzle demands. `solve({ maxTier })` caps it and returns
  `{ solved, hardestTier, techniqueCounts, passes, avgOpenSingles }` — the inputs for K4's two-factor
  score.
- **Soundness is load-bearing:** every technique only makes deductions true in all solutions, so a
  full logical solve equals the unique exact solution.

### Verification (K3)

**Gate met.** Soundness fuzzed against the K2 exact solver: no logically-placed digit ever disagrees
with the unique solution (solved or not) across 4×4/6×6. Gradable share measured **89–100%** across
{QuadOp, +−, ×÷, add-only} — the hardest-tier distribution concentrates at T1/T2, so (like Killer)
played difficulty will ride the two-factor score within a tier, not the tier ceiling alone. 4 tests;
full suite **291 green**.

---

## K4 — Difficulty configs + generation ✅

The two-factor scorer + the graded generation pipeline. New files
[`calc-score.ts`](../src/features/engine/calc/calc-score.ts) and
[`calc-sudoku.ts`](../src/features/engine/calc/calc-sudoku.ts); `CalcPuzzle`/`CalcDifficulty` added
to `calc-types.ts`.

- **`calc-score.ts`** — `final = raw × densityFactor`, mirroring Killer's scorer with Keisan
  technique weights. `raw` = weighted sum of technique applications; density scales bottlenecked
  grids up, open grids down.
- **`calc-sudoku.ts`** — `generateCalcSudoku(difficulty, { gridSize })`: fill a boxless Latin square
  → cage shapes → operator assignment → **shape gate** (single-cell-cage min/max band) → logical
  solve capped at the tier → **score band** → uniqueness (belt-and-braces, since a sound full solve
  already implies uniqueness). `generateCalcBatch` for bulk. `CalcPuzzle` = `{ variant:'calc', grid
  (all-zero), solution, cages, difficulty, gridSize }`.
- **Difficulty rides the score, not the tier** — K3 showed most puzzles are T1/T2, so the tier is
  just a ceiling and the two-factor score does the separating. Bands are **measured per-size** and
  not comparable across sizes (a "hard 4×4" ≠ "hard 6×6").

### Calibration (measured, QuadOp, maxSize 3)

| Size | easy | medium | hard |
|---|---|---|---|
| 4×4 | score `< 3.5` | `[3.5, 6.5)` | `≥ 6.5` |
| 6×6 | `< 9` | `[9, 16)` | `≥ 16` |

### Verification (K4)

**Gate met:** every band generates in **avg 1–2 ms** (max ≤ 9 ms, far under the 1 s budget), **0
fails in 40**, and score ranges are **disjoint per size**. 8 tests (well-formed + unique + in-band
per size/difficulty, batch counts); full suite **299 green**. v1 is QuadOp only; SingleOp/DualOp and
No-Op mode remain difficulty axes for a later slice.

---

## K5 — Surfaces 🚧 (core done; daily rotation deferred)

Keisan is now **playable, printable, and discoverable** in the app. Shipped across three sub-commits.

### K5a — 3-way variant discriminant + board data path

- **Real discriminant** replacing the duck-typed `'cages' in puzzle`: killer/calc carry an explicit
  `variant` tag, classic has none, so `'variant' in puzzle ? puzzle.variant : 'classic'`
  distinguishes all three (the old check couldn't tell killer from calc — both have cages).
- `PuzzleVariant` += `'calc'`; `BoardPuzzle` union += `CalcPuzzle`.
- **Cage geometry generalized:** `computeCageOutline` takes `LabeledCage {cells, label}`;
  `CageSum.value` → `label`. The board normalizes both cage types to `BoardCage {id, cells, label}`
  at `startNewGame` (Killer label = sum; Keisan = target+operator `12+`/`3÷`, or bare value for a
  single-cell given). CageOverlay + PDF updated.
- **Keisan uses a boxless config** even at 4/6 → row/col-only peers, no box borders (K0 gating).
  Cage-mate pencil stripping stays **Killer-only** (Keisan permits repeats). persist v3 → v4.

### K5b — `/play` board

- `/api/puzzle` Keisan branch (4×4/6×6, easy/medium/hard). PlayExperience: Classic/Killer/Keisan
  toggle, per-variant size lists (Keisan 4/6), `?variant=calc` deep link, Continue-banner label.
- **Fix (visual check):** the candidate pencil grid was cut off by the cage label. Extended the
  Killer cage-label top-clearance CSS (`data-variant`) to cover `'calc'`.

### K5c — PDF export + `/generate`

- Extracted a shared `drawCagedGrid`; added `drawCalcGrid` (boxless, operator labels) +
  `generateCalcPDF`. `/api/generate` Keisan branch + PuzzleForm Keisan section. Verified end-to-end
  (a 7-page 4×4 booklet).

### K5d — Hub card

- The "Coming soon" KenKen card is now a live **Keisan** card (`/play?variant=calc`, 🧮) wearing the
  `new!` sticker (moved off Killer, per the "newest wears new!" convention).

### Deferred — the daily rotation

Keisan is **not yet in the daily rotation**. That follow-up needs: daily registry rows, the
variant-safe daily discriminant fixes (`toDailyPuzzleRow`, `dailies.service` dispatch, `/api/daily`
serving still duck-type `'cages'` — *correct today* since only classic/killer are registered),
a fourth picker section, per-board anti-cheat floors + bot times, and leaderboard tabs. Free-play +
PDF + hub already deliver the full Keisan experience; the daily is additive.

### Verification (K5)

299 tests green; typecheck / lint / markdownlint / `next build` clean. API + PDF verified via the
running dev server. Board/generate/hub handed off for a visual check (both themes, 4×4 + 6×6).

---

## Difficulty rebalance ✅

Playtesting flagged that even "hard" was givens-heavy and small-caged (the exact problem we hit with
Killer). A new research doc ([kenken-difficulty-calibration.md](research/kenken-difficulty-calibration.md),
`keen.c` + KSudoku + billabob) confirmed it and quantified the fix: single-cell givens are "the
single strongest lever," cage size and combo-count next. K4's first cut leaned almost entirely on the
score band, so the shapes never changed across tiers.

### What changed

- **Shape now leads, score refines.** Per-tier shape configs (`calc-sudoku.ts`):
  givens taper (easy several → **hard ~1**), cage size climbs (**6×6 hard → `maxSize: 4`**; 4×4 stays
  ≤3 — a size-4 cage is a quarter of the board), and easy drops `×` (`+ − ÷` — factor reasoning is a
  difficulty step, gated to medium+).
- **New `maxCombos`/foothold lever.** `maxFootholds` caps "gift" cages (2+-cell cages with exactly one
  valid multiset, e.g. `3−`={1,4}) so hard can't lean on free anchors; `maxCombosPerCage` is the
  ceiling form (available, unused in v1). This is the research's "quantitative core" lever, which
  Killer had dropped as a no-op — it earns its keep here because Keisan's *multiset* cages are where
  the ambiguity lives.
- **Score bands re-cut** on the new measured distributions (4×4: `<5 / [5,9) / ≥9`; 6×6: `<19 /
  [19,31) / ≥31`).

### De-risk + result

The one real risk was `maxSize: 4` verify-time (Killer's maxSize-4 thrashed at 6–160 **s**). Measured
first: Keisan's multiset pruning verifies maxSize-4 6×6 in **~0.2 ms avg** — no thrash.

### Full lever spec (second pass)

A companion doc ([keisan-difficulty-levers.md](research/keisan-difficulty-levers.md)) gave the
implementable per-(size × tier) tables, so the rebalance was extended to the full lever set (4×4 +
6×6; 5×5/7×7 deferred by choice):

- **`maxCombosPerCage` caps** (per-cage ambiguity ceiling), **hard = 0 givens**, **4×4 hard `maxSize:
  4`** (playtest-OK).
- **Operator-mix weighting** — easy `+`-heavy, hard **×-weighted (~55%)** — via `operatorWeights` in
  `assignCalcCages`.
- **Gift-clue bans** (`giftBanLevel`: `combos1` → `twoCell` → `mulLowFactor`, keen.c patterns) capped
  by `maxFootholds`.
- **Bent-cage lever** built (`minBentRatio` + `isBentCage`) but **left ungated**: `maxSize: 4` already
  yields ~61% bent naturally, and forcing a floor halved the generation yield for no structural gain.
- **Technique floor** (`techniqueFloor: 1` on hard — Tatham's gate). Applied *lightly*: measurement
  showed our solver's `hardestTier` concentrates at T1/T2 (medium vs hard differ by score, not tier),
  so the **score band is the primary tier gate** (HoDoKu weighted-sum style); a stronger Tatham gate
  awaits a richer solver (a future K3 expansion).

**Yield lesson (found via a flaky test):** 6×6 hard's stacked gates drop the accept rate to ~0.1%, so
the old default `maxAttempts: 4000` occasionally *exhausted*. Attempts are cheap (~0.07 ms — most are
shape-rejected before the logical solve), so wall-clock stays ~78 ms avg; the fix was dropping the
low-value bent floor (~2× the yield) and raising `maxAttempts` to 40 000.

**Operator-mix follow-up (playtest):** an early `{mul:4}`-heavy hard weight left **subtraction and
division nearly absent** — they're 2-cell-only, and hard's big cages can only be `+`/`×`, so `×`
crowded them out. Fixed with equal `mul/sub/div` weights: `×` still wins ~60% of the `+`/`×`-only big
cages (~39% overall, ≥ the doc's 30%) while **~96% of 6×6 hard boards now keep some `−`/`÷`**. Div
stays naturally lower (needs divisible pairs).

**Gate (full-spec):** gen **avg ≤ 78 ms** (max ~245 ms on 6×6 hard), **0 fails in 40**, disjoint
bands, flaky tests stable across repeated runs. Structure: **6×6 hard = 0 givens, ~4.7 four-cell
cages, ~61% bent, ~39% `×`, −/÷ in ~96% of boards**. Calc tests added: easy-no-`×`, hard-is-chunky,
hard-×-weighted-with-`−`/`÷`-variety.

### Deliberately deferred (endorsed sequencing)

- **K6 — No-Op / Mystery mode:** an orthogonal toggle (any size/difficulty), not a 5th tier. Needs
  solver support for operator-union cage pruning, uniqueness-across-interpretations, and a new
  operator-deduction grading technique — its own slice.
- **K7 — 9×9 + the full 5-tier ladder:** where Expert/Extreme naturally live (per-size-normalized, per
  the research). 5×5/7×7 are already representable from K0.

---

## K5 tail — daily rotation

*Not started (see the K5 "Deferred" note above).*
