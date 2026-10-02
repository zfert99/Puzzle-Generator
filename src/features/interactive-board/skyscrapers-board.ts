import {
  clueAt,
  clueStatus,
  lineFor,
  type ClueStatus,
  type GutterSide,
  type SkyscraperClues,
} from '@/features/engine/skyscrapers/skyscrapers-types';

/** The line a clue on this side reads, named from its edge: "top of column 2", "left of row 3". */
function lineName(side: GutterSide, index: number): string {
  const axis = side === 'top' || side === 'bottom' ? 'column' : 'row';
  return `${side} of ${axis} ${index + 1}`;
}

/** The state word a screen reader hears; "open" (the engine's word) is "unsolved" to a listener. */
const STATE_WORD: Record<ClueStatus, string> = { open: 'unsolved', satisfied: 'satisfied', violated: 'violated' };

/**
 * The accessible name of a clue cell. It names the edge the clue reads from (plan decision D9)
 * because a screen-reader user cannot see which edge the cell sits on — "from the top of column
 * 2" is the direction — then its state: "Clue 3, from the top of column 2, unsolved" /
 * "…, satisfied" / "…, violated" / "…, marked done". A blank clue (0) still gets a name, so the
 * gutter keeps its shape for assistive technology: "No clue, top of column 2". The G8 pass over
 * the accessibility tree shortened both forms (the first draft read "Clue cell, looking down from
 * the top of column 2, blank" — ten words per blank cell when arrowing along a gutter) and
 * replaced the engine's "open" with "unsolved", which a listener does not hear as "expandable".
 */
export function describeSkyscraperClue(
  side: GutterSide,
  index: number,
  clue: number,
  status: ClueStatus = 'open',
  done = false
): string {
  if (clue <= 0) return `No clue, ${lineName(side, index)}`;
  const state = done ? 'marked done' : STATE_WORD[status];
  return `Clue ${clue}, from the ${lineName(side, index)}, ${state}`;
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
