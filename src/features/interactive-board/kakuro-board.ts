import type { Run } from '@/features/engine/kakuro/kakuro-types';
import { buildClues, kakuroTracks, type KakuroClue } from '@/features/engine/kakuro/kakuro-layout';

/**
 * The clue picture — display coordinates, the gutter, and which black cell carries which sums —
 * is the puzzle's, not the board's: the PDF draws the same thing. It lives in the engine
 * (`kakuro-layout.ts`, V3) and is re-exported here under the board's names so the store and the
 * cells keep one import for everything Kakuro-shaped.
 */
export type BoardClue = KakuroClue;
export { buildClues, kakuroTracks };

/**
 * Interior mask of the cells a player can never fill: black = "in no run" (plan decision D3).
 * Empty array when there are no runs, which is every non-Kakuro game.
 */
export function buildBlocked(runs: readonly Run[], size: number): boolean[][] {
  if (runs.length === 0) return [];
  const blocked = Array.from({ length: size }, () => Array<boolean>(size).fill(true));
  for (const run of runs) {
    for (const cell of run.cells) blocked[Math.floor(cell / size)][cell % size] = false;
  }
  return blocked;
}

/**
 * Kakuro's peers are **run-mates**: the other cells of a white cell's across run and down run.
 * Those are the only cells a placed digit constrains (no repeats within a run), so they are
 * what pencil-mark stripping and the peer highlight should reach — the row/column/box peers
 * `computePeers` builds are wrong here. Black cells get an empty list. Empty array when there
 * are no runs.
 */
export function computeRunPeers(runs: readonly Run[], size: number): number[][] {
  if (runs.length === 0) return [];
  const peers: Set<number>[] = Array.from({ length: size * size }, () => new Set<number>());
  for (const run of runs) {
    for (const cell of run.cells) {
      for (const mate of run.cells) if (mate !== cell) peers[cell].add(mate);
    }
  }
  return peers.map((set) => [...set]);
}

/**
 * Flat interior index → the ids of its across run (slot 0) and down run (slot 1), −1 when the
 * cell is black or has no run in that direction. Two slots per cell in one flat array. This is
 * what makes "is that cell a run-mate of the selection?" an O(1) comparison in every cell's
 * selector — the same reason the store precomputes `cellToCage` for Killer (INP, AGENTS.md §3).
 */
export function buildCellToRuns(runs: readonly Run[], size: number): number[] {
  if (runs.length === 0) return [];
  const cellToRuns = new Array<number>(size * size * 2).fill(-1);
  for (const run of runs) {
    const slot = run.dir === 'across' ? 0 : 1;
    for (const cell of run.cells) cellToRuns[cell * 2 + slot] = run.id;
  }
  return cellToRuns;
}

/** Do two interior cells share an across run or a down run? O(1) via `buildCellToRuns`. */
export function shareRun(cellToRuns: readonly number[], a: number, b: number): boolean {
  if (cellToRuns.length === 0) return false;
  return (
    (cellToRuns[a * 2] !== -1 && cellToRuns[a * 2] === cellToRuns[b * 2]) ||
    (cellToRuns[a * 2 + 1] !== -1 && cellToRuns[a * 2 + 1] === cellToRuns[b * 2 + 1])
  );
}

/** The accessible name of a clue cell: "Clue: across 17, down 23", or "Blocked cell". */
export function describeClue(clue: BoardClue | null | undefined): string {
  const parts: string[] = [];
  if (clue?.across != null) parts.push(`across ${clue.across}`);
  if (clue?.down != null) parts.push(`down ${clue.down}`);
  return parts.length > 0 ? `Clue: ${parts.join(', ')}` : 'Blocked cell';
}
