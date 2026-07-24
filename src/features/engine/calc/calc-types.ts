/**
 * Core Calcudoku data shapes and the operator model.
 *
 * Calcudoku (generically also "Mathdoku"; "KenKen" is a trademark of KenKen Puzzle LLC, avoided
 * here) is an N×N **Latin square** (1..N once per row and column — NO boxes) partitioned into
 * cages, each showing a target and an arithmetic operator. Unlike Killer Sudoku, a digit MAY
 * repeat within a cage as long as the repeats don't share a row or column — which is why the
 * cage-combination tables are **multisets**, not distinct-digit sets (see `calc-combinations.ts`).
 * This module owns the operator vocabulary and the two invariants the operator model turns on:
 * subtraction/division are two-cell-only, and single-cell cages are givens (no operator).
 *
 * **Naming:** the puzzle is displayed as **Keisan** (Japanese 計算, "calculation") — shown in
 * menus as "Keisan" alongside "Classic" (Sudoku) and "Killer" (Killer Sudoku), with a hub-card
 * subtitle explaining it. The engine module, symbols, and board `variant` slug stay the
 * descriptive **`calc`** — a deliberate slug-vs-display split kept to avoid churn; do NOT "fix"
 * the mismatch. ("KenKen" is trademarked and avoided; "Calcudoku"/"Mathdoku" are the generic
 * names the puzzle is also known by.)
 *
 * See `calc-types.md` for the "why".
 */

import type { GridSize } from '../sudoku';

/**
 * The four cage operators. Named rather than symbol-keyed (`'add'` not `'+'`) so the code reads
 * without punctuation ambiguity and `'div'` never collides with the `/` operator. No-Op /
 * "Mystery" mode (operator hidden) is a deferred later slice, so it is deliberately absent here.
 */
export type CalcOperator = 'add' | 'sub' | 'mul' | 'div';

/** Display glyphs for cage labels (`12+`, `3−`, `6×`, `2÷`). Surfacing/labels are K5. */
export const OPERATOR_SYMBOL: Record<CalcOperator, string> = {
  add: '+',
  sub: '−', // U+2212 MINUS SIGN (not hyphen) — the label glyph, not code
  mul: '×',
  div: '÷',
};

/**
 * A Calcudoku cage: a connected group of cells whose solution digits produce `target` under `op`.
 * `cells` holds FLAT indices (`row * size + col`), same convention as Killer's `Cage`. A cage of
 * one cell is a **given** — its `target` is the digit and its `op` is irrelevant (`'add'` by
 * convention). Subtraction/division cages are always exactly two cells (see
 * `operatorAllowedForCageSize`).
 */
export interface CalcCage {
  /** Stable id, used for React keys and cage-border lookup. */
  id: number;
  op: CalcOperator;
  /** The cage's clue value: the sum / difference / product / quotient of its digits. */
  target: number;
  /** Flat cell indices (`row * size + col`); length ≥ 1, orthogonally connected. */
  cells: number[];
}

/** Keisan difficulty tiers (v1: easy/medium/hard; expert may follow, like Killer). */
export type CalcDifficulty = 'easy' | 'medium' | 'hard';

/**
 * A generated Keisan puzzle. `grid` is all-zero — Keisan has no pre-filled givens (a single-cell
 * cage shows its value as a cage label, not a placed digit). The cages are the clue. `variant`
 * tags it for the board-store union (the display name is "Keisan"; the slug stays `calc`).
 */
export interface CalcPuzzle {
  variant: 'calc';
  grid: number[][];
  /** Solved grid. SERVER-ONLY for ranked dailies. */
  solution: number[][];
  cages: CalcCage[];
  difficulty: CalcDifficulty;
  gridSize: GridSize;
}

/**
 * Compute a cage's target from its solution digits under an operator — the inverse of the
 * combination tables, used by generation (K2) to label a cage once its cells are known.
 *
 * - **add:** the sum. **mul:** the product.
 * - **sub / div (two cells):** order-independent by the two-cell convention — larger minus /
 *   divided by the smaller. Non-associativity is why these are two-cell-only, so this only
 *   accepts exactly two digits and throws otherwise (a caller bug — the operator was assigned to
 *   a cage that can't legally hold it).
 *
 * @throws if `op` is `sub`/`div` and `digits.length !== 2`.
 */
export function computeTarget(op: CalcOperator, digits: readonly number[]): number {
  switch (op) {
    case 'add':
      return digits.reduce((sum, d) => sum + d, 0);
    case 'mul':
      return digits.reduce((product, d) => product * d, 1);
    case 'sub':
    case 'div': {
      if (digits.length !== 2) {
        throw new Error(`${op} cages are two-cell only — got ${digits.length} digits`);
      }
      const hi = Math.max(digits[0], digits[1]);
      const lo = Math.min(digits[0], digits[1]);
      return op === 'sub' ? hi - lo : hi / lo;
    }
  }
}

/**
 * Is `op` legal for a cage of `size` cells?
 *
 * - Single-cell cages are **givens**, not operator cages → no operator is "legal" (a 1-cell cage
 *   just shows its value).
 * - **sub / div** are **two-cell only** (the Shortz/NYT + KSudoku convention this engine adopts;
 *   see the plan). Non-associativity makes 3+-cell −/÷ ambiguous.
 * - **add / mul** work for any cage of 2+ cells.
 */
export function operatorAllowedForCageSize(op: CalcOperator, size: number): boolean {
  if (size < 2) return false;
  if (op === 'sub' || op === 'div') return size === 2;
  return true;
}

/**
 * Does the active operator set contain at least one operator assignable to a cage of `size`
 * cells? This is the **legality invariant** the K2 operator assigner must assert: any cage of 3+
 * cells needs `add` or `mul` in the set (a "sub only" / "div only" set is unsatisfiable for big
 * cages and would silently wedge generation). Single-cell cages are givens, so they never need an
 * operator — always assignable.
 */
export function hasAssignableOperator(activeOps: readonly CalcOperator[], size: number): boolean {
  if (size < 2) return true; // a given — no operator required
  return activeOps.some((op) => operatorAllowedForCageSize(op, size));
}
