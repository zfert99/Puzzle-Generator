/**
 * Skyscrapers (Towers) display geometry — the first piece of the engine module (plan slice V0).
 *
 * A puzzle is stored as the **interior** N×N only (plan decision D2); what a player sees is that
 * play area inside a one-cell clue gutter on all four sides. The helpers here map between the two,
 * and live in the engine rather than beside the board because the PDF renderer (V3) is a known
 * second consumer of exactly this picture (log learning L2). V1 adds the puzzle shape, the clue
 * arrays and `visibleCount` to this file.
 */

/** Which strip of the clue gutter a display cell belongs to. */
export type GutterSide = 'top' | 'bottom' | 'left' | 'right';

/**
 * One cell of the (N+2)×(N+2) picture: the N×N play area, a gutter cell on each of the four
 * sides (indexed along its side), or one of the four corners where two gutters meet.
 */
export type DisplayCell =
  | { kind: 'play'; row: number; col: number }
  | { kind: 'gutter'; side: GutterSide; index: number }
  | { kind: 'corner' };

/** Display tracks per axis for an interior size N: the play area plus a gutter cell on each side. */
export function skyscrapersTracks(size: number): number {
  return size + 2;
}

/**
 * Expands an interior size N into the (N+2)×(N+2) display grid. Display index 0 and N+1 on
 * either axis are the gutter; display (r, c) is play cell (r − 1, c − 1). Unlike Kakuro, whose
 * clues live inside the grid and along two edges, every Skyscrapers clue sits outside the play
 * area, so the gutter is symmetric on all four sides and the corners hold nothing.
 */
export function buildDisplayCells(size: number): DisplayCell[][] {
  const tracks = skyscrapersTracks(size);
  const last = tracks - 1;
  const isEdge = (i: number) => i === 0 || i === last;

  return Array.from({ length: tracks }, (_, r) =>
    Array.from({ length: tracks }, (_, c): DisplayCell => {
      if (isEdge(r) && isEdge(c)) return { kind: 'corner' };
      if (r === 0) return { kind: 'gutter', side: 'top', index: c - 1 };
      if (r === last) return { kind: 'gutter', side: 'bottom', index: c - 1 };
      if (c === 0) return { kind: 'gutter', side: 'left', index: r - 1 };
      if (c === last) return { kind: 'gutter', side: 'right', index: r - 1 };
      return { kind: 'play', row: r - 1, col: c - 1 };
    })
  );
}
