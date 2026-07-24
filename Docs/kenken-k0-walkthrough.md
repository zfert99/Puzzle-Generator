# KenKen K0 — Boxless-Grid Foundation: Walkthrough

> **Status:** ✅ Done · **Branch:** `feature/kenken` · **Slice:** K0 of the
> [KenKen implementation plan](kenken-implementation-plan.md)
> **What it enables:** the type/engine/renderer foundation for boxless (Latin-square-only)
> grids, so K1–K5 build on a size-open, box-optional base. No KenKen gameplay yet — this is the
> pure enabling refactor the plan's reuse audit surfaced.

## Why K0 exists

Auditing the plan's Killer-reuse claims against the live code found that `GridSize = 4 | 6 | 9`
is a **closed union** and box assumptions leak far outside the engine (both grid renderers, the
board store's peer/border logic). 5×5/7×7 — KenKen's headline differentiator vs. Killer — is
therefore a type/engine/renderer change, not a KenKen-module-local one. Landing it first means
the later slices don't each rediscover the coupling.

## What changed

### Engine / types

- **`GridSize` widened `4 | 6 | 9` → `4 | 5 | 6 | 7 | 9`** ([sudoku.ts](../src/features/engine/sudoku.ts)).
  Prime sizes 5/7 are *boxless* (no rectangular box tiling exists for a prime N — the exact
  structural reason box-Sudoku can't offer them and KenKen can).
- **`GridConfig` gained `hasBoxes: boolean`.** `getGridConfig` returns `hasBoxes: false` for 5/7
  with the box dims set to a **row-strip sentinel** (`boxWidth = size`, `boxHeight = 1`). The
  sentinel is chosen so that any code reading the box dims *without* checking `hasBoxes`
  degenerates the box constraint to the row constraint it already enforces — harmless, never
  corrupting a Latin square. Consumers that actually branch on boxes use `hasBoxes`.
- **`isValid` short-circuits after the row/column scan when `!hasBoxes`**
  ([grid-utils.ts](../src/features/engine/grid-utils.ts)) — rows + columns are the whole rule for
  a Latin square.
- **`fillGrid` needs no change** — the row-strip sentinel makes `boxOf(r, c)` collapse to `r`, so
  `boxMask[r]` mirrors `rowMask[r]` and the box term is a redundant no-op. This deliberately adds
  **no branch to the hot loop** (protecting the AGENTS.md §3 benchmark). The K0 Latin-square test
  at 5/7 guards the sentinel: change it and that test fails.
- **`applyQuotaDigger`'s quota map is now `Partial<Record<GridSize, …>>`**
  ([diggers.ts](../src/features/engine/diggers.ts)) with a `?.` + `?? 40` fallback, so we don't
  invent fake quotas for classic puzzles that can't exist at 5/7 (boxless has no classic digger).
- **`HumanSolver` throws on any size other than 4/6/9** ([human-solver.ts](../src/features/engine/human-solver.ts)).
  The old catch-all `else` silently assumed 3×3 boxes for anything else — which would quietly
  mis-solve a boxless 5×5/7×7 grid. HumanSolver is box-Sudoku-only; KenKen writes its own row/col
  techniques and must never route through it, so an unsupported size is now a loud programming
  error, not a grid to guess at.

### Renderers (gated on `hasBoxes`)

- **Board `Cell.tsx`** — the box-peer highlight and the thick box-border flags are gated on
  `config.hasBoxes`, so a boxless board peers only through rows/columns and draws no phantom
  interior box borders.
- **PDF `drawGrid` + `drawKillerGrid`** — the base grid-line loop draws thick lines at box
  boundaries only when `hasBoxes`; boxless grids get a heavier outer frame and thin interior
  lines. `drawKillerGrid`'s boxless branch is dormant today (KillerPuzzle is always 6/9) and
  exists for the KenKen K5 PDF reuse.

### Persistence

- **Board store `persist` version bumped `2 → 3`** ([useBoardStore.ts](../src/features/interactive-board/store/useBoardStore.ts)).
  `config` is persisted, so a pre-K0 saved game would rehydrate with `hasBoxes: undefined` →
  falsy → phantom boxless rendering on a 4/6/9 board. Saved games are ephemeral, so the existing
  discard-on-mismatch `migrate` cleanly drops the stale shape (the initial config, which has
  `hasBoxes`, takes over). No user-facing loss beyond an in-flight game across the deploy — the
  same trade-off the `2` bump already made for `mode`.

## Judgment calls worth recording

- **`fillGrid` box-conditionalization was pulled forward from K2 into K0.** The plan slotted it in
  K2, but adding `hasBoxes` is a K0 concern and the sentinel makes `fillGrid` correct with *zero*
  hot-loop change — so doing it here (with a guarding test) makes K0's foundation genuinely
  testable rather than speculative, at no perf cost. K2 now just *uses* the boxless fill.
- **The scattered `4 | 6 | 9` literal unions were left narrow on purpose.** GridSizeSelector,
  PlayExperience/PuzzleForm state, and the two API `VALID_GRID_SIZES` allowlists are independent
  narrower unions — widening `GridSize` doesn't break them, and they *should* stay `4 | 6 | 9`
  because classic/Killer don't support 5/7 and KenKen's UI isn't wired yet. They get their own
  per-variant size lists when KenKen's surfaces land (K5). This keeps K0 a true "no behavior
  change" refactor: 5/7 is only *representable*, never *offered*.

## Verification

- **Typecheck:** `tsc --noEmit` clean (confirms the narrower UI/API unions didn't break).
- **Lint:** `npm run lint` + `markdownlint` on all touched docs — clean.
- **Tests:** full suite **248 passed** (was 239 + 9 new K0 tests: boxless `getGridConfig`,
  Latin-square `fillGrid` at 5/7, boxless `isValid`, and the `HumanSolver` size guard).
- **Benchmark** (AGENTS.md §3, since `fillGrid`/`human-solver` are core solving logic): Basic
  **0.11 ms** and Advanced **0.18 ms** — at their historical best, confirming no hot-path
  regression. Extreme logged 12.45 ms, within its known noise band (6.33–55 ms historically on
  unchanged code; it's 10 puzzles × 1000 iterations at the hardest tier). K0 adds no hot-path
  branch, so the stable Basic/Advanced numbers are the meaningful signal.

## Not done here (deferred by design)

- No `kenken` variant, generator, solver, or UI — that's K1 onward.
- The 5/7 sizes are representable but **not offered** in any picker; that ships with KenKen's
  surfaces (K5) behind per-variant size lists.
- A manual visual check of a genuinely boxless board is deferred until something actually renders
  one (K2/K5) — there's no boxless puzzle to display yet.
