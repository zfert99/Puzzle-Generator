import type { CSSProperties } from 'react';
import type { KakuroPuzzle } from '@/features/engine/kakuro/kakuro-types';
import styles from './KakuroBoard.module.css';

/** On a block, `across` / `down` are the clue sums of the runs starting right of / below it. */
type DisplayCell =
  | { kind: 'white' }
  | { kind: 'block'; across?: number; down?: number };

/**
 * Expands a puzzle's interior N×N into the (N+1)×(N+1) picture a player sees: a one-cell clue
 * gutter along the top and left (plan decision D2), plus the interior itself. Display index 0
 * on either axis is the gutter, so interior (r, c) is display (r + 1, c + 1).
 *
 * Driven entirely by the runs: a cell is white when some run contains it (D3 — "blocked" means
 * "in no run"), and a run's clue belongs to the cell just before its first cell — one step left
 * for an across run, one step up for a down run. That cell is always a block or the gutter.
 */
function buildDisplayCells(puzzle: KakuroPuzzle): DisplayCell[][] {
  const { gridSize, runs } = puzzle;
  const tracks = gridSize + 1;
  const cells: DisplayCell[][] = Array.from({ length: tracks }, () =>
    Array.from({ length: tracks }, (): DisplayCell => ({ kind: 'block' }))
  );

  for (const run of runs) {
    for (const cell of run.cells) {
      cells[Math.floor(cell / gridSize) + 1][(cell % gridSize) + 1] = { kind: 'white' };
    }
  }

  for (const run of runs) {
    const row = Math.floor(run.cells[0] / gridSize) + 1;
    const col = (run.cells[0] % gridSize) + 1;
    const clueCell = run.dir === 'across' ? cells[row][col - 1] : cells[row - 1][col];
    if (clueCell.kind !== 'block') continue;
    if (run.dir === 'across') clueCell.across = run.sum;
    else clueCell.down = run.sum;
  }

  return cells;
}

function cellLabel(cell: DisplayCell, r: number, c: number): string {
  if (cell.kind === 'white') return `Row ${r}, column ${c}, empty`;
  const parts: string[] = [];
  if (cell.across != null) parts.push(`across ${cell.across}`);
  if (cell.down != null) parts.push(`down ${cell.down}`);
  return parts.length > 0 ? `Clue: ${parts.join(', ')}` : 'Blocked cell';
}

/**
 * The static Kakuro board (plan slices V0–V1): draws a puzzle's white cells, black cells and
 * clue cells with their sums, and nothing else — no selection, no input, no solution digits. A
 * Server Component on purpose: there is no state to own yet, and the puzzle is static data, so
 * there is no hydration concern. V2 replaces this with the interactive board on `useBoardStore`.
 *
 * It already carries the WAI-ARIA grid skeleton (grid → row → gridcell, read-only) because V2
 * needs exactly that structure and it costs nothing to draw it right the first time.
 */
export function KakuroBoard({ puzzle }: { puzzle: KakuroPuzzle }) {
  const cells = buildDisplayCells(puzzle);

  return (
    <div
      role="grid"
      aria-label={`Kakuro board, ${puzzle.gridSize} by ${puzzle.gridSize}`}
      aria-readonly="true"
      className={styles.board}
      style={{ '--tracks': cells.length } as CSSProperties}
    >
      {cells.map((row, r) => (
        <div key={r} role="row" className={styles.row}>
          {row.map((cell, c) => {
            if (cell.kind === 'white') {
              return <div key={c} role="gridcell" aria-label={cellLabel(cell, r, c)} className={styles.cell} />;
            }
            const isClue = cell.across != null || cell.down != null;
            return (
              <div
                key={c}
                role="gridcell"
                aria-label={cellLabel(cell, r, c)}
                className={`${styles.cell} ${styles.block} ${isClue ? styles.clue : ''}`}
              >
                {cell.down != null && <span className={styles.down}>{cell.down}</span>}
                {cell.across != null && <span className={styles.across}>{cell.across}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
