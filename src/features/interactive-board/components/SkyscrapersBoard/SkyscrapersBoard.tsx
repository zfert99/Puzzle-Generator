import type { CSSProperties } from 'react';
import {
  buildDisplayCells,
  type GutterSide,
  type SkyscrapersPuzzle,
} from '@/features/engine/skyscrapers/skyscrapers-types';
import styles from './SkyscrapersBoard.module.css';

/** Where a clue on this side looks: the direction a solver reads the line from that edge. */
const LOOKING: Record<GutterSide, string> = {
  top: 'down from the top of column',
  bottom: 'up from the bottom of column',
  left: 'right from the left of row',
  right: 'left from the right of row',
};

/**
 * The accessible name of a gutter cell spells the direction the clue reads in (plan decision
 * D9), because a screen-reader user cannot see which edge the cell sits on. A blank clue (0)
 * still gets a name, so the gutter keeps its shape for assistive technology.
 */
export function gutterLabel(side: GutterSide, index: number, clue = 0): string {
  const what = clue > 0 ? `Clue ${clue}` : 'Clue cell';
  return `${what}, looking ${LOOKING[side]} ${index + 1}${clue > 0 ? '' : ', blank'}`;
}

/**
 * The looks-only Skyscrapers board (plan slices V0–V1): the puzzle's clue digits in a four-sided
 * gutter around an empty N×N play area with a heavier frame, and nothing else — no selection,
 * no input, no store. A Server Component on purpose: there is no state to own and the puzzle is
 * static data, so there is no hydration concern. V2 replaces this with the interactive board on
 * `useBoardStore`.
 *
 * It already carries the WAI-ARIA grid skeleton V2 needs. Every row exposes the same N+2
 * cells — the corners are empty read-only gridcells, not hidden elements — so assistive
 * technology sees one rectangular grid; `aria-rowindex` / `aria-colindex` on every cell and the
 * counts on the grid make that explicit (D9). Gutter cells are read-only and named by the
 * direction their clue reads in; play cells are named by position.
 */
export function SkyscrapersBoard({ puzzle }: { puzzle: SkyscrapersPuzzle }) {
  const { gridSize: size, clues } = puzzle;
  const cells = buildDisplayCells(size);
  const tracks = cells.length;
  const last = tracks - 1;

  return (
    <div
      role="grid"
      aria-label={`Skyscrapers board, ${size} by ${size}`}
      aria-rowcount={tracks}
      aria-colcount={tracks}
      className={styles.board}
      style={{ '--tracks': tracks } as CSSProperties}
    >
      {cells.map((row, r) => (
        <div key={r} role="row" aria-rowindex={r + 1} className={styles.row}>
          {row.map((cell, c) => {
            if (cell.kind === 'corner') {
              return <div key={c} role="gridcell" aria-readonly="true" aria-colindex={c + 1} />;
            }
            if (cell.kind === 'gutter') {
              const clue = clues[cell.side][cell.index];
              return (
                <div
                  key={c}
                  role="gridcell"
                  aria-readonly="true"
                  aria-colindex={c + 1}
                  aria-label={gutterLabel(cell.side, cell.index, clue)}
                  className={styles.gutter}
                >
                  {clue > 0 ? clue : null}
                </div>
              );
            }
            // The frame is drawn on the play cells that touch the gutter, so the heavy border
            // belongs to the play area rather than to the whole board (research §6: a bold
            // outline around the N×N with plain digits outside it).
            const classes = [styles.play];
            if (r === 1) classes.push(styles.frameTop);
            if (r === last - 1) classes.push(styles.frameBottom);
            if (c === 1) classes.push(styles.frameLeft);
            if (c === last - 1) classes.push(styles.frameRight);
            return (
              <div
                key={c}
                role="gridcell"
                aria-colindex={c + 1}
                aria-label={`Row ${cell.row + 1}, column ${cell.col + 1}, empty`}
                className={classes.join(' ')}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
