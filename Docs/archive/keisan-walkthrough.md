# Keisan — Feature Walkthrough

> **📦 Archived 2026-08-03 — completed phase walkthrough.** Keisan (Phase 8) is feature-complete,
> so this build log is closed; the "🚧 In Progress" status below is frozen as written mid-build.
> Its content is still accurate about *what was built and why* — including the dated **Superseded**
> notes added when the daily restructure changed the read path. The live design doc is
> [kenken-implementation-plan.md](../kenken-implementation-plan.md), which stays in the active
> `Docs/` root because engine source cites its K0 section.

<!-- -->

> **What this is:** the running build log for the Keisan puzzle type (Phase 8), one section
> per slice as it lands. The forward-looking design lives in the
> [implementation plan](../kenken-implementation-plan.md); this doc records *what was actually built*
> and the judgment calls made along the way. Append a new section as each slice (K2…) ships.
>
> **Status:** 🚧 In Progress — engine K0–K4 ✅ · surfaces K5 core ✅ (play/PDF/hub) · difficulty
> rebalance ✅ · daily rotation ✅ · **K7a (9×9, 3 tiers) ✅** · **K7b (bounded-recursion "T5") ✅** ·
> **K7c (9×9 Expert = needs a Nishio guess) ✅** · **K7d (9×9 Extreme = needs *many* Nishio steps) ✅**
> · **K6 (Mystery / No-Op mode) ✅** — feature-complete (engine + all surfaces); optional follow-ons
> only (a Mystery *daily* board; 5×5/7×7) · **Branch:** `feature/kenken`

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

- **`GridSize` widened `4|6|9` → `4|5|6|7|9`** ([sudoku.ts](../../src/features/engine/sudoku.ts)). 5/7
  are *boxless* (prime → no rectangular box tiling — the structural reason box-Sudoku can't offer
  them and Keisan can).
- **`GridConfig` gained `hasBoxes: boolean`.** `getGridConfig` returns `hasBoxes: false` for 5/7
  with a **row-strip box sentinel** (`boxWidth = size`, `boxHeight = 1`) so any code reading the box
  dims without checking `hasBoxes` degenerates the box constraint to the row constraint it already
  enforces — harmless, never corrupting a Latin square. Real box consumers branch on `hasBoxes`.
- **`isValid` short-circuits after the row/column scan when `!hasBoxes`**
  ([grid-utils.ts](../../src/features/engine/grid-utils.ts)).
- **`fillGrid` needs no change** — the sentinel makes `boxOf(r, c)` collapse to `r`, so `boxMask[r]`
  mirrors `rowMask[r]` and the box term is a redundant no-op. Deliberately **no branch added to the
  hot loop** (AGENTS.md §3). The K0 Latin-square test at 5/7 guards the sentinel.
- **`applyQuotaDigger`'s quota map is now `Partial<Record<GridSize, …>>`**
  ([diggers.ts](../../src/features/engine/diggers.ts)) — no fake quotas for classic puzzles that can't
  exist at 5/7.
- **`HumanSolver` throws on any size other than 4/6/9** ([human-solver.ts](../../src/features/engine/human-solver.ts)).
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
[`src/features/engine/calc/`](../../src/features/engine/calc/); nothing calls it yet.

### Operator model — [`calc-types.ts`](../../src/features/engine/calc/calc-types.ts)

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

### Combination tables — [`calc-combinations.ts`](../../src/features/engine/calc/calc-combinations.ts)

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
[`calc-solver.ts`](../../src/features/engine/calc/calc-solver.ts) and
[`calc-generator.ts`](../../src/features/engine/calc/calc-generator.ts).

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
[`calc-logical-solver.ts`](../../src/features/engine/calc/calc-logical-solver.ts).

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
[`calc-score.ts`](../../src/features/engine/calc/calc-score.ts) and
[`calc-sudoku.ts`](../../src/features/engine/calc/calc-sudoku.ts); `CalcPuzzle`/`CalcDifficulty` added
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
Killer). A new research doc ([kenken-difficulty-calibration.md](../research/kenken-difficulty-calibration.md),
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

A companion doc ([keisan-difficulty-levers.md](../research/keisan-difficulty-levers.md)) gave the
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
  *(The `~61%` is wrong — measured 0.527 at this commit, ~0.488 today. See the correction note at the
  end of this section; the decision to leave the lever ungated still stands.)*
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

> **Correction (2026-08-03) — the `~61% bent` in the gate record above is wrong.** Left in place
> because this is a record of what the gate was believed to show at the time; the figure is
> corrected here rather than rewritten above. Re-measured over 4200+ boards the bent rate is
> **0.488** of multi-cell cages, and it was **0.527** even at this commit — so 61% was never
> accurate, and the gate was signed off against a number nobody re-derived. The further drop to
> ~0.48 came later, from the operator reweight recorded two paragraphs up: `−`/`÷` are 2-cell-only
> operators, so restoring their variety raised the 2-cell share of cages (31.7% → 38.6%), and a
> 2-cell cage is always collinear and so never bent. That is a wanted tradeoff, not a regression —
> the bent rate among cages of size ≥3 is ~78%. The stale figure had a live consequence: a unit
> test threshold was calibrated against it and became a ~2%-per-run CI flake. The other two
> structural figures in this record hold up (`~39% ×` vs 0.380 measured; `−/÷ in ~96%` vs 0.935).
> Full record: [`research/keisan-test-flake-and-bent-ratio-divergence.md`](../research/keisan-test-flake-and-bent-ratio-divergence.md).

### Deliberately deferred (endorsed sequencing)

- **K6 — No-Op / Mystery mode:** an orthogonal toggle (any size/difficulty), not a 5th tier. Needs
  solver support for operator-union cage pruning, uniqueness-across-interpretations, and a new
  operator-deduction grading technique — its own slice.
- **K7 — 9×9 + the full 5-tier ladder:** where Expert/Extreme naturally live (per-size-normalized, per
  the research). 5×5/7×7 are already representable from K0.

---

## K5 tail — daily rotation ✅

Keisan is now in the daily rotation, and the daily path was made **variant-safe** in the process
(the audit-flagged duck-typing).

- **Registry:** `calc4-{easy,medium,hard}` + `calc6-{easy,medium,hard}` (6 boards → 25 total), each
  with a `minSolveMs` anti-cheat floor and a tuned "Sudoku Bot" `botTimeMs`. **Sectioning matches the
  other variants:** the 4×4/6×6 Keisan boards live in the **minis** section (alongside the classic
  and killer minis), and the top-level **Keisan** section mirrors "Classic 9×9" / "Killer 9×9" — it's
  reserved for **9×9 Keisan (K7)** and auto-hidden while empty (the picker/leaderboard skip
  zero-board sections).
  > **Superseded (August 2026).** Those six `calc4-*`/`calc6-*` keys are retired from generation
  > (still readable for archive replay), and the four-section picker collapsed to **Standard** +
  > **Minis**. The daily is now one slot per puzzle *type* with the difficulty rolled per day — see
  > [daily-redesign-plan.md](../daily-redesign-plan.md). The per-board `minSolveMs`/`botTimeMs` values
  > survive unchanged; they moved into the `(variant, size, difficulty)` profile table. The bot is
  > now "Puzzle Bot".
- **Variant-safe discriminants** (replacing `'cages' in puzzle`, which couldn't tell Killer from
  Keisan — both carry cages):
  - `toDailyPuzzleRow` now keys off the explicit `variant` tag.
  - `dailies.service` generation dispatch is a real 3-way (`killer`/`calc`/classic).
  - `/api/daily` serving derives the variant from the board's **registry key** (`getDailyBoard`), not
    from cages presence, and returns `variant: 'calc'` + the operator+target cages.
    > **Superseded (August 2026).** `getDailyBoard` no longer exists. The
    > [daily restructure](../daily-redesign-plan.md) moved the type into a stored
    > `daily_puzzles.variant` column (migration `0004`), and `/api/daily` reads that column — a key
    > like `hard` holds a different type each day, so it can no longer be parsed for one. The point
    > this bullet records still stands: cage *presence* was never a safe discriminant, because
    > Killer and Keisan both have cages.
- **Storage:** `StoredCage` is now `StoredKillerCage | StoredCalcCage` — the jsonb column already
  accepted either shape, so **no DB migration** was needed.
- **Board + UI:** `useDaily`'s response union gains a `calc` arm; the served daily flows straight
  through `startNewGame` (same `variant` branch as free play). A **Keisan** section was added to both
  the `/daily` picker and the leaderboard tabs.
- **Anti-cheat unchanged:** the solve check is `gridsMatch(submitted, solution)` — variant-agnostic —
  so ranked Keisan solves validate through the existing `/api/solve` path.

### Verification (daily tail)

Unit-tested end to end at the boundaries: registry shape + `formatDailyKey('calc6-hard')` →
"keisan 6×6 hard"; `toDailyPuzzleRow` maps a Keisan puzzle variant-safely with op+target cages;
`generateDailyPuzzles` generates all boards (incl. the calc ones) for real + seeds the bot solve
on each (DB mocked at the boundary). Typecheck / lint / `next build` clean. The live DB round-trip
(seed → fetch → solve → rank) runs via the daily cron (or a manual `db:seed`).

## K7a — 9×9 Keisan, 3 tiers ✅

The first slice of the re-sliced K7. A 9×9 de-risk killed the original "just add a 5-tier ladder"
plan, so K7a ships the honest, cheap part: **9×9 easy/medium/hard**, interactive-fast, in the daily
rotation's top-level **Keisan** section (mirroring "Classic 9×9" / "Killer 9×9"). Expert/Extreme wait
for K7b/K7c. Full rationale: [keisan-9x9-feasibility-findings.md](../research/keisan-9x9-feasibility-findings.md)
and the [honest-ladder research](../research/keisan-9x9-honest-ladder.md).

### What the de-risk forced

Three measured walls (see the findings doc): maxSize-5 cages are infeasible (0% gradable, ~50×
verify), the logical solver caps at **~T2** on 9×9 (no technique ladder to hang tiers on), and
single-cell givens are load-bearing for feasibility. So the tiers can't come from a technique ladder
— they come from **givens + operators**:

- **Max cage size 3 at every tier** (maxSize-4 = ~13× verify for no gain; real 9×9 Calcudoku is
  2–3-cell dominated).
- **Givens gradient, disjoint by construction:** the givens distribution is bimodal (`minSize: 1` →
  ~15–17, `minSize: 2` → ~2), so **Easy ≥12 givens** (TRI_OP, no ×), **Medium 6–11** (QUAD_OP), **Hard
  ≤3** (QUAD_OP + `techniqueFloor: 1`). Disjoint singles ranges ⇒ disjoint tiers regardless of score.
- **No score band.** Measured scores overlap heavily (easy p50 36 / medium 39 / hard 61) because the
  solver barely discriminates at 9×9 — a cut would misclassify. This *is* the "no technique ladder"
  finding, so 9×9 leans on givens, not the HoDoKu-style band that 4×4/6×6 use.

### The two speed traps (and fixes)

- **`maxFootholds` on 9×9 tanked Hard's accept rate ~25×** (→ ~400 ms gen). With ~25 cages/board, a
  tight gift-cage count rejects nearly every board. Dropped it → Hard generates in **~14 ms avg**,
  same measured difficulty. Same reason the per-cage combo ceiling is off at 9×9 (a 3-cell cage
  naturally reaches 13 combos).
- **`verifyNodeBudget`** added to the config (caps the uniqueness proof on pathological low-givens
  boards: `-1` "unsettled in budget" → cheap reject, never a false accept). Not needed at K7a's
  settings but wired for the harder K7b/K7c tiers.

### Surfaces + dailies

`DIFFICULTY_CONFIG_9` + a widened `gridSize: 4 | 6 | 9` thread through `/play` (size selector now
`[4, 6, 9]` for Keisan; no expert/extreme, matching the minis), `/generate` (Keisan size button adds
9×9; PDF is already size-generic), and both API routes. Three daily boards `calc9-{easy,medium,hard}`
join the registry in the new `calc` section — which the picker/leaderboard auto-show now that it's
populated (they skipped it while empty).

### Verification (K7a)

Gate met (100 boards/tier): gen **p95 ≤ 38 ms** (easy 22 / medium 19 / hard 38), **max 136 ms**;
**100% gradable** every tier; givens **13–23 / 7–11 / 0–3** (disjoint, monotonic); Hard carries −/÷
in **100%** of boards. Full test battery green (68 calc + daily + service tests); tsc / lint clean;
4×4/6×6 generation unchanged (no shared-path edits — the grade-before-verify order stayed put).

## K7b — bounded-recursion "T5" ✅ (with a plan-changing finding)

The honest answer to "the named ladder caps at ~T2 on 9×9, so what discriminates the hardest
0-given boards?" — Tatham's `keen.c` design, where the top tiers have **no bespoke technique** and
are produced by counted guess-and-check. Built into `CalcLogicalSolver` as **tiers 5 (depth-1
Nishio) and 6 (depth-2)**.

### Mechanism

When T1–T4 stall, `nishioRound` scans empty cells min-remaining-values-first and, for each
candidate, `isRefutable` hypothesises it (`snapshot` → `place` → `deducePlain` with T1–T4 →
`restore`); if the branch hits a contradiction, the candidate is a **sound elimination**.
`hasContradiction` flags a dead branch two ways: an empty cell with zero candidates, **or** a
fully-placed cage matching no valid multiset (the latter catches a guess that fills a cage's last
cell directly — `cageArithmetic` only prunes empty cells, so it can't). The solve loop escalates
**minimal depth first**, so `hardestTier = 4 + maxGuessDepth` records the *cheapest* guess a board
needs; a `guessNodeBudget` (default 200 k) bounds the depth-2 path. Every elimination is sound → a
completed guess-solve is a valid logical solution path (tested: a T4-stuck 9×9 solves at T5 with the
grid matching the exact solution).

### The finding — depth-2 never fires

Measured on unique low-givens 9×9 boards: ~77% solve at T4, **~23% are T4-stuck**, and **depth-1
Nishio solves 100% of the T4-stuck ones, all verified correct**. Across *both* maxSize-3 and
maxSize-4 populations, **not one board needed depth-2** (maxSize-4 T6 grading also costs p95 ~7 s —
slow for no payoff). T5 grading is ~65 ms avg / ~450 ms p95 at maxSize 3.

So the guess-*depth* axis is a **single step** (needs-a-guess vs not), exactly the contingency K7b
flagged. The mechanism stays (depth-2 is dormant capacity for later sizes / No-Op), but 9×9 uses
depth-1 only.

### Why this blocks K7c (per the roadblock rule)

K7c planned to split Expert↔Extreme by guess-depth. Depth-2 doesn't exist, so depth gives **one**
guess-gated tier, not two — K7c can't be built as specified. Following the new *Roadblock & Research
Rules*, I stopped and wrote the fork up (options 1–4) in
[keisan-9x9-feasibility-findings.md](../research/keisan-9x9-feasibility-findings.md) §6b + the plan's
K7c entry, rather than improvising an Extreme tier the data doesn't support. K7b itself is complete
and committed; K7c awaits a tier-shape decision.

### Verification (K7b)

New solver tests: a T4-stuck 9×9 solves at T5 with the grid matching the exact solution and
`maxGuessDepth === 1`; a T4-solvable board reports `maxGuessDepth === 0`. Existing soundness fuzz
still green. tsc / lint / markdownlint clean; no generator changes yet (the T5 solver is capability
only — Expert/Extreme configs land in K7c once the tier shape is decided).

## K7c — 9×9 Expert (4-tier ladder) ✅

The tier-shape decision resolved via an external research pass (chosen: research option 4). The
verdict — [full doc](../research/keisan-9x9-option4-validation.md),
folded into the [technique-expansion brief](../research/keisan-solver-technique-expansion-research.md#-research-verdict-external-pass-complete-2026-07-27)
— was blunt: **ship the 4-tier ladder now; don't block on a fifth tier** (uneven tier counts across
variants are normal and low-confusion; a *dishonest* Extreme is worse than none). The would-be
Extreme (a real technique-separated tier) became **K7d** — instrumented and gated, may not land, with
No-Op/Mystery (K6) and Nishio-step-count as honest fallbacks.

### What Expert is

A **near-0-given 9×9 board whose hardest required step is a depth-1 Nishio guess** — i.e. the K7b
bounded-recursion tier is genuinely needed. Config: `solveCap: 5` (admits the guess tier) +
`techniqueFloor: 4` (rejects anything T1–T4 already cracks). That makes Expert **disjoint from Hard by
construction** (Hard caps at T4; Expert *requires* T5), so no score band is needed — and the score
runs far higher anyway (~99 vs Hard's ~61). Honest player-facing framing: "solvable with logic plus
one hypothesis step."

### De-risk

Measured before wiring: Expert generation accepts 50/50, **gen avg 239 ms / p95 792 ms / max 1.8 s**,
givens ~1. That's offline-cron-pool-friendly and interactive-tolerable (Killer extreme is ~5 s and
ships interactive), so Expert is offered everywhere the other tiers are.

### Surfaces

`CalcDifficulty` widened to include `expert` (9×9-only; the config map is now `Partial` per size so
4×4/6×6 legitimately omit it and `generateCalcSudoku` throws for an unsupported pair). Threaded
through `/play` (Expert appears in the Keisan difficulty list, disabled at 4/6 by the existing
mini-grid guard; the variant-switch clamp fixed so calc 9×9 keeps Expert), `/generate` (Expert count
shown only at calc 9×9; PDF already size-generic), and both API routes (with an "Expert is 9×9-only"
guard). A `calc9-expert` daily board joins the `calc` section (bot time above Hard).

### Verification (K7c)

New tests: Expert is 0-given, unique, T4-can't-finish, T5-solves with `hardestTier === 5` /
`maxGuessDepth === 1`, and throws at 4×4/6×6. Daily registry asserts the `calc` section is
`[easy, medium, hard, expert]` and `formatDailyKey('calc9-expert') === 'keisan expert'`. Full battery
green; tsc / lint / markdownlint clean.

## K7d — 9×9 Extreme (the 5th tier), and how Option 2 won ✅

The instrumented attempt at a genuine fifth tier. Chosen path was the research's staged plan
(Slice 0 instrument → Slice 1 cage-line intersection → Slice 2 pairwise multi-cage elimination), but
**Slice 0 answered the question outright and the technique slices weren't needed.**

### Slice 0 — instrumentation + the finding

Added `guessSteps` to `CalcSolveResult` (the *count* of bounded-recursion eliminations, distinct from
`maxGuessDepth`). Baselined the 0-given corpus:

- **Hardest-required-step distribution** (400 unique boards): **71% top out at T2** (naked pair), ~4%
  at T4 (X-Wing), **~0% at T3** (lineSum-as-hardest never fires — confirming it's single-line-only),
  and **22% jump straight to Nishio**. A big gap between T2 and the guess tier — what Slices 1-2 would
  have tried to fill.
- **But the guess-STEP count is the prize.** Among Nishio boards it spreads **1 → 23** (p50 2, p90 6),
  and it is **strongly monotone with difficulty**: median solve time climbs **8.6 → 15 → 36 → 75 →
  239 ms** across the 1 / 2-3 / 4-5 / 6-8 / 9+ step buckets — a ~28× spread. Score and passes rise
  monotonically too.

That's a clean, honest fifth-tier axis with **zero solver expansion** — the research's revived
"Option 2" (Pelánek: *count of hard steps* is signal). So Slices 1-2 (cage-line intersection, pairwise
multi-cage elimination) were **deferred** — the step-count gave a cheaper, cleaner tier. They remain
written up in the [technique-expansion brief](../research/keisan-solver-technique-expansion-research.md)
if a future need arises.

### Extreme = many Nishio steps

New config lever `minGuessSteps` / `maxGuessSteps` on the guess-step count. **Extreme = `minGuessSteps:
6`** (needs ≥6 hypothesis steps); **Expert gains `maxGuessSteps: 5`** so the two are disjoint by the
step band (both still require the Nishio tier via `techniqueFloor: 4`). The cut at 6 gives the
cleanest difficulty gap (Expert 1-5 steps ~8-36 ms solve, Extreme 6+ ~75-239 ms). Honest framing:
Expert = "logic + a few hypothesis steps", Extreme = "logic + *many*".

### De-risk + surfaces

Extreme generation: **~1.1% accept, ~2.3 s/board** (rare + slow because every candidate pays a T5
grade) — an offline-cron-pool / slow-interactive tier, like Killer extreme (both routes already carry
`maxDuration = 60`). Threaded through `/play` (Extreme in the Keisan list, gated to 9×9; a "can take a
few seconds" hint; the variant-switch clamp simplified to the now-uniform "expert/extreme need 9×9"
rule), `/generate` (Extreme count only at calc 9×9), both API routes, and a `calc9-extreme` daily
board.

### Verification (K7d)

New test: Extreme is unique, T5-solves with `hardestTier === 5` and **`guessSteps ≥ 6`** (disjoint
from Expert's ≤5), and throws at 4×4/6×6. Daily registry asserts the `calc` section is now
`[easy, medium, hard, expert, extreme]` and `formatDailyKey('calc9-extreme') === 'keisan extreme'`.
312 tests green; tsc / lint / markdownlint clean; 4×4/6×6 untouched.

## K6 — Mystery / No-Op mode ✅

An orthogonal **🔮 Mystery toggle** (any size/difficulty): every cage shows only its target, and the
player must deduce the operator (+ − × ÷) along with the digits. Sequenced last so it applies across
the whole finished ladder, including 9×9 Expert/Extreme.

### The whole thing is one combination-table function

The original plan feared "real engine work, not a flag" — a new operator-deduction solver technique,
bespoke uniqueness logic. It turned out **far cleaner**, because the entire solver stack already
reasons off the cage-combination table. The arithmetic difference of Mystery mode is a single
function, **`calcNoOpCombosFor(size, target, N)`** — the *deduplicated union* of the multisets every
legal operator would produce (2-cell: + − × ÷; 3+-cell: + ×). A one-line dispatch,
**`calcCageCombos(cage, N)`**, returns that union when `cage.noOp` else the plain table, and both
solvers' cage-multiset precompute + the generator's shape gate route through it. So **uniqueness
"across every operator interpretation" and gradability-without-the-operator both fell out for free** —
zero new techniques, zero per-technique no-op branches.

### The rest

- `CalcCage.noOp` + `StoredCalcCage.noOp` (jsonb, no migration) carry the flag; the generator's `noOp`
  option flags every multi-cell cage before the gates.
- Rendering: the board label (`useBoardStore`) and PDF omit the operator symbol when `noOp` (a no-op
  cage shows just `"12"`, like a single-cell given).
- Surfaces: a 🔮 Mystery toggle on `/play` and `/generate`, threaded through `usePuzzle` /
  `usePuzzleGeneration` → both API routes → the engine.
- The single-operator "freebie" gift heuristics are skipped for no-op cages (their op is hidden); the
  gift/combo shape gates otherwise read the union count.

### De-risk + verification

Gate met: **4×4/6×6 easy/medium/hard all 30/30 unique + gradable** in no-op mode (6×6 easy the
slowest at ~82 ms avg — the union tightens the small-cage easy band). Tests: `calcNoOpCombosFor` is
the dedup'd union (2-cell all four ops, 3+-cell + × only); `calcCageCombos` dispatches on `noOp`; no-op
generation yields unique, gradable puzzles with every multi-cell cage flagged. **316 tests green**;
tsc / lint / markdownlint clean.

**Scope note:** interactive `/play` + `/generate` PDF only. No Mystery *daily* board yet — a cheap
follow-on (thread a `noOp` flag through the board registry + service), deliberately deferred to keep
this slice focused.
