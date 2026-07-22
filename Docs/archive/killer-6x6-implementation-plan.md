# 6×6 Killer Sudoku — Implementation Plan

> **Status:** ✅ Done (July 2026) — all three gates met; see slice outcomes inline · **Branch:** `feature/killer-sudoku`
> **Research:** [killer-grid-sizes.md](../research/killer-grid-sizes.md) ·
> **Sibling plans:** [killer-sudoku-implementation-plan.md](killer-sudoku-implementation-plan.md),
> [killer-expert-implementation-plan.md](killer-expert-implementation-plan.md)

Adds **6×6 Killer** (digits 1–6, mandatory 2×3 boxes, Rule of 21) as a beginner-friendly
variant. The research is unambiguous about scope: *6×6 is the only non-9×9 Killer size with
real product demand* — positioned as an onboarding format for learning the cage mechanic —
while 8×8/12×12/16×16 are novelty. So this plan ships 6×6 and nothing else.

## What the research says (and what it means here)

- **Nothing conceptual changes — only constants.** Rule of 45 → Rule of 21 (N(N+1)/2); max
  cage size caps at N; combination tables shrink dramatically. Our engine already computes
  `houseSum` generically, so the 45-rule tiers work untouched.
- **Parameterize on grid order N** (KSudoku's design). The one place we hardcode N = 9 is the
  **combination tables** (`cage-combinations.ts`: `MAX_DIGIT = 9`, `MAX_SUM = 45`). Using
  9-digit tables on a 6×6 is subtly wrong: unions admit false candidates (2-cell sum 8 keeps
  digit 1 via the 9-digit combo {1,7} even though no 6×6 combo contains it), magic-cage and
  foothold detection miscount, and difficulty gates misfire. **The tables must be
  digit-parameterized** — everything else follows.
- **Beginner positioning** → 6×6 ships **easy/medium/hard only** (like classic minis), tier
  caps ≤ 3; expert/extreme stay 9×9-only (their tier-4/5 techniques are gated to size 9
  anyway).

## Current readiness (surveyed)

Already size-generic: cage generator, exact solver (bitmask `full = (1<<size)−1`), logical
solver's houses/regions/houseSum, cage geometry, board store + `CageOverlay`
(`viewBox 0 0 size size`), PDF `drawKillerGrid`, solve/leaderboard flow. Hardcoded to 9:
`cage-combinations.ts` (tables), `killer-sudoku.ts` (`GRID_SIZE`, `gridSize: 9` in the
`KillerPuzzle` type, one `DIFFICULTY_CONFIG`), API validation, and the `/play` Killer menu
(forces 9×9).

## Slices

### M1 — Digit-parameterized combination tables — ✅ (tables per 4/6/9, defaults byte-preserve 9×9, false-candidate tests)

- `cage-combinations.ts`: build tables per digit-count (6 and 9); every public fn gains a
  trailing `maxDigit = 9` param (default preserves all existing callers). The
  `candidateMaskExcluding` memo key includes the digit count.
- Tests: exact 6×6 combo counts (e.g. 2-cell sum 7 = {1,6},{2,5},{3,4}; 3-cell 21 has none —
  max 3-cell is 15), the false-candidate case above, and a 6-vs-9 table independence check.

**Gate:** all existing 9×9 tests untouched and green.

### M2 — Engine plumbing + 6×6 difficulty configs — ✅ (cuts 16/28 measured; 1.7–9.2 ms avg, 0 fails; 180-solve fuzz clean; 9×9 unregressed)

- `KillerSolver` + `KillerLogicalSolver`: thread `size` into every combos call (both already
  know their size). Tier-4/5 techniques stay 9×9-gated.
- `killer-sudoku.ts`: `generateKillerSudoku(difficulty, { gridSize })` (default 9);
  `KillerPuzzle.gridSize: 6 | 9`. `DIFFICULTY_CONFIG` becomes per-size; 6×6 entries get their
  own shape gates + score bands placed on **measured 6×6 distributions** (the recalibration
  protocol — 36-cell traces score in a different range than 81-cell ones; never reuse 9×9
  cuts).
- Soundness fuzz: 6×6 logical solves vs exact solutions, zero mismatches required.

**Gate:** 6×6 easy/medium/hard generate < 100 ms avg, 0 fails in 20, bands disjoint,
9×9 benchmarks unregressed.

### M3 — Surfaces — ✅ (play + PDF size toggles, APIs validate 6|9, E2E 12/12, sample has a 6×6 section)

- `/play`: Killer variant gains a 6×6/9×9 size choice (reuse the classic grid-size selector
  pattern); expert/extreme chips hidden at 6×6.
- `/api/puzzle` + `/api/generate`: accept `gridSize: 6` for killer; PDF batch + sample
  regenerated with a 6×6 section; preview script updated.
- E2E: 6×6 Killer play spec (36 cells, cage overlay, no givens). Docs mirrored; roadmap.

**Gate:** full battery (unit + build + E2E) green; 6×6 verified in-browser.

## Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Threading `maxDigit` through every combos call-site misses one → subtle 9-digit leak on 6×6 | Grep-audit all `combosFor`/`candidateMaskFor`/`candidateMaskExcluding`/`guaranteedMaskFor` callers; the M1 false-candidate test catches the exact-solver path, the fuzz catches the logical path. |
| 2 | 6×6 difficulty feels compressed (only 21 sums, 36 cells) | Expected — it's the research's onboarding format. Bands are measured, not copied; if hard-6×6 measures barely above medium, ship easy/medium/hard anyway and say so in the docs. |
| 3 | Score-band drift on 9×9 from shared code changes | 9×9 tables/configs byte-identical by construction (defaults); re-run the 9×9 benchmark in M2's gate. |
