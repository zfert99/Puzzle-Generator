import {
  clueAt,
  clueStatus,
  lineFor,
  type ClueStatus,
  type GutterSide,
  type SkyscraperClues,
} from '@/features/engine/skyscrapers/skyscrapers-types';

/** Where a clue on this side looks: the direction a solver reads the line from that edge. */
const LOOKING: Record<GutterSide, string> = {
  top: 'down from the top of column',
  bottom: 'up from the bottom of column',
  left: 'right from the left of row',
  right: 'left from the right of row',
};

const STATUS_WORD: Record<ClueStatus, string> = {
  open: 'open',
  satisfied: 'satisfied',
  violated: 'violated',
};

/**
 * The accessible name of a clue cell. It spells the direction the clue reads in (plan decision
 * D9) because a screen-reader user cannot see which edge the cell sits on, then its state —
 * "Clue 3, looking down from the top of column 2, open" / "…, satisfied" / "…, violated" /
 * "…, marked done". A blank clue (0) still gets a name, so the gutter keeps its shape for
 * assistive technology: "Clue cell, looking …, blank".
 */
export function describeSkyscraperClue(
  side: GutterSide,
  index: number,
  clue: number,
  status: ClueStatus = 'open',
  done = false
): string {
  const where = `looking ${LOOKING[side]} ${index + 1}`;
  if (clue <= 0) return `Clue cell, ${where}, blank`;
  const state = done ? 'marked done' : STATUS_WORD[status];
  return `Clue ${clue}, ${where}, ${state}`;
}

/**
 * One clue's current state against the board, read from the grid the way the engine reads a
 * line (first element nearest the clue). This is the per-clue selector's whole job: O(N) for one
 * line, never a pass over all 4N clues on a keystroke (INP, AGENTS.md §3).
 */
export function skyscraperClueState(
  clues: SkyscraperClues,
  grid: readonly (readonly number[])[],
  side: GutterSide,
  index: number
): { clue: number; status: ClueStatus } {
  const clue = clueAt(clues, side, index);
  return { clue, status: clueStatus(lineFor(grid, side, index), clue) };
}
