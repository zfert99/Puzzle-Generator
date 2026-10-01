import type { Run } from '@/features/engine/kakuro/kakuro-types';

/**
 * The sums a Kakuro black cell carries, in **display** coordinates — the (N+1)×(N+1) picture
 * with the clue gutter as row 0 and column 0, so interior (r, c) is display (r + 1, c + 1).
 * `across` heads the run to its right, `down` the run below it.
 */
export interface BoardClue {
  across?: number;
  down?: number;
}

/** A Kakuro's display grid has one more track than its interior on each axis (the gutter). */
export function kakuroTracks(size: number): number {
  return size + 1;
}

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
 * Display index → clue for every black cell that heads at least one run. A run's clue sits on
 * the cell just before its first cell — one step left for an across run, one step up for a
 * down run — which in display coordinates is always inside the grid (the gutter absorbs the
 * interior's edge). Cells heading no run map to `null`. Empty array when there are no runs.
 */
export function buildClues(runs: readonly Run[], size: number): (BoardClue | null)[] {
  if (runs.length === 0) return [];
  const tracks = kakuroTracks(size);
  const clues: (BoardClue | null)[] = new Array(tracks * tracks).fill(null);
  for (const run of runs) {
    const row = Math.floor(run.cells[0] / size) + 1;
    const col = (run.cells[0] % size) + 1;
    const index = run.dir === 'across' ? row * tracks + (col - 1) : (row - 1) * tracks + col;
    const clue = clues[index] ?? (clues[index] = {});
    if (run.dir === 'across') clue.across = run.sum;
    else clue.down = run.sum;
  }
  return clues;
}

/** The accessible name of a clue cell: "Clue: across 17, down 23", or "Blocked cell". */
export function describeClue(clue: BoardClue | null | undefined): string {
  const parts: string[] = [];
  if (clue?.across != null) parts.push(`across ${clue.across}`);
  if (clue?.down != null) parts.push(`down ${clue.down}`);
  return parts.length > 0 ? `Clue: ${parts.join(', ')}` : 'Blocked cell';
}
