# Keisan — Feature Walkthrough

> **What this is:** the running build log for the Keisan puzzle type (Phase 8), one section
> per slice as it lands. The forward-looking design lives in the
> [implementation plan](kenken-implementation-plan.md); this doc records *what was actually built*
> and the judgment calls made along the way. Append a new section as each slice (K2…) ships.
>
> **Status:** 🚧 In Progress — K0 ✅ · K1 ✅ · K2–K5 next · **Branch:** `feature/kenken`

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

## K2 — Exact solver + Latin-square generator

*Not started.*
