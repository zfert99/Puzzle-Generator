import type { GridConfig } from '@/features/engine/sudoku';
import type { Run } from '@/features/engine/kakuro/kakuro-types';
import { deduceKakuro } from '@/features/engine/kakuro/kakuro-solver';
import { explainKakuroHint, type KakuroTechnique } from '@/features/engine/kakuro/kakuro-logical-solver';
import { deduceSkyscrapers } from '@/features/engine/skyscrapers/skyscrapers-solver';
import { explainSkyscrapersHint, type SkyscrapersTechnique } from '@/features/engine/skyscrapers/skyscrapers-logical-solver';
import type { SkyscraperClues } from '@/features/engine/skyscrapers/skyscrapers-types';

/** What a solver-driven hint hands back to the store: where to place, and the note to show. */
export interface DeducedHint {
  target: { r: number; c: number };
  note: {
    cell: number;
    digit: number;
    technique: KakuroTechnique | SkyscrapersTechnique | null;
    explanation: string;
    leadUp: string[];
  };
}

/** The board state a deducer reads — a narrow view of the store, never the store itself. */
export interface HintContext {
  grid: readonly number[][];
  solution: readonly number[][];
  config: GridConfig;
  /** The selected cell when it is empty and editable, else `null`. */
  preferredCell: number | null;
  runs: readonly Run[];
  edgeClues: SkyscraperClues | null;
}

type Deducer = (ctx: HintContext) => DeducedHint | null;

/**
 * Only a deduction that **agrees with the solution** may be placed (Kakuro L9): propagation
 * from a board that already holds a wrong entry can force a digit that is consistent with the
 * mistake and wrong against the answer, and a hint must never plant one — but one bad forced
 * cell must not discard the rest, so the deducers pick the preferred cell if it agrees, else
 * the first forced cell that does.
 */
function pickAgreeing(
  ctx: HintContext,
  forced: readonly { cell: number; digit: number }[]
): { cell: number; digit: number } | null {
  const agrees = (f: { cell: number; digit: number }) => agreesWithSolution(ctx, f);
  return forced.find((f) => f.cell === ctx.preferredCell && agrees(f)) ?? forced.find(agrees) ?? null;
}

/** The one place a candidate placement is checked against the answer (L9). */
function agreesWithSolution(ctx: HintContext, f: { cell: number; digit: number }): boolean {
  const size = ctx.config.size;
  return f.digit === ctx.solution[Math.floor(f.cell / size)][f.cell % size];
}

const toTarget = (cell: number, size: number) => ({ r: Math.floor(cell / size), c: cell % size });

/**
 * Kakuro: first the logical solver's next placement — a named technique with a plain-English
 * reason — then the exact solver's propagation (sound, but unexplained). No detour (the
 * default): the preferred cell is honoured only when it is the very next deduction, so the
 * explanation always describes the board as the player sees it.
 */
const kakuro: Deducer = (ctx) => {
  const size = ctx.config.size;
  const shape = { gridSize: size, runs: ctx.runs };
  const explained = explainKakuroHint(shape, ctx.grid, { preferCell: ctx.preferredCell ?? undefined });
  if (explained && agreesWithSolution(ctx, explained)) {
    return {
      target: toTarget(explained.cell, size),
      note: { cell: explained.cell, digit: explained.digit, technique: explained.technique, explanation: explained.explanation, leadUp: explained.leadUp },
    };
  }
  const { forced, contradiction } = deduceKakuro(shape, ctx.grid);
  if (contradiction) return null;
  const pick = pickAgreeing(ctx, forced);
  if (!pick) return null;
  return { target: toTarget(pick.cell, size), note: { ...pick, technique: null, explanation: 'Forced by the runs it sits in (no single named step)', leadUp: [] } };
};

/**
 * Skyscrapers: the same shape as Kakuro's — first the logical solver's next placement, a named
 * technique with a reason (E2), then the exact solver's propagation, sound but unexplained (E1).
 * The explainer itself confines every placing rule to the selected cell first, so a selected
 * cell the board can deduce is hinted by name (a clue-N climb, a single, …) and the deducer
 * needs no precedence of its own. The agree-with-solution check gates both routes (L9).
 */
const skyscrapers: Deducer = (ctx) => {
  if (!ctx.edgeClues) return null;
  const size = ctx.config.size;
  const shape = { gridSize: size, clues: ctx.edgeClues };
  const explained = explainSkyscrapersHint(shape, ctx.grid, { preferCell: ctx.preferredCell ?? undefined });
  if (explained && agreesWithSolution(ctx, explained)) {
    return {
      target: toTarget(explained.cell, size),
      note: { cell: explained.cell, digit: explained.digit, technique: explained.technique, explanation: explained.explanation, leadUp: explained.leadUp },
    };
  }
  const { forced, contradiction } = deduceSkyscrapers(shape, ctx.grid);
  if (contradiction) return null;
  const pick = pickAgreeing(ctx, forced);
  if (!pick) return null;
  return {
    target: toTarget(pick.cell, size),
    note: { ...pick, technique: null, explanation: 'Forced by the clues and the row and column it sits in (no single named step)', leadUp: [] },
  };
};

/** The variants whose hints come from a solver. Every other variant reveals from the solution. */
const DEDUCERS: Partial<Record<string, Deducer>> = { kakuro, skyscrapers };

/**
 * A solver-driven hint for `variant`, or `null` when the variant has no solver, the board holds
 * a contradiction, or nothing forced agrees with the answer — the store then falls back to the
 * plain reveal. Registering a variant here is the whole of wiring its solver to the Hint button.
 */
export function deduceHintFor(variant: string, ctx: HintContext): DeducedHint | null {
  return DEDUCERS[variant]?.(ctx) ?? null;
}
