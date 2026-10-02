import type { CSSProperties } from 'react';
import styles from './SkyscrapersBoard.module.css';

/** Which strip of the clue gutter a display cell belongs to, if any. */
export type GutterSide = 'top' | 'bottom' | 'left' | 'right';

/**
 * One cell of the (N+2)×(N+2) picture a player sees: the N×N play area, a one-cell clue gutter
 * on all four sides, and the four corners where two gutters meet (which hold nothing).
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
 * area, so the gutter is symmetric on all four sides and the corners are dead.
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

/** Where a clue on this side looks: the direction a solver reads the line from that edge. */
const LOOKING: Record<GutterSide, string> = {
  top: 'down from the top of column',
  bottom: 'up from the bottom of column',
  left: 'right from the left of row',
  right: 'left from the right of row',
};

/**
 * The accessible name of a gutter cell spells the direction the clue reads in (plan decision
 * D9), because a screen-reader user cannot see which edge the cell sits on. V0 has no clue
 * values yet, so every gutter cell reads as blank.
 */
export function gutterLabel(side: GutterSide, index: number): string {
  return `Clue cell, looking ${LOOKING[side]} ${index + 1}, blank`;
}

/**
 * The looks-only Skyscrapers board (plan slice V0): an empty N×N play area inside a four-sided
 * clue gutter, with a heavier frame around the play area and nothing else — no digits, no
 * selection, no input, no store. A Server Component on purpose: there is no state to own and
 * the size is static data, so there is no hydration concern. V2 replaces this with the
 * interactive board on `useBoardStore`.
 *
 * It already carries the WAI-ARIA grid skeleton (grid → row → gridcell) that V2 needs: play
 * cells are gridcells, gutter cells are read-only gridcells named by the direction their clue
 * reads in, and the four corners are presentational and hidden from assistive technology.
 */
export function SkyscrapersBoard({ size }: { size: number }) {
  const cells = buildDisplayCells(size);
  const last = cells.length - 1;

  return (
    <div
      role="grid"
      aria-label={`Skyscrapers board, ${size} by ${size}`}
      aria-readonly="true"
      className={styles.board}
      data-size={size}
      style={{ '--tracks': cells.length } as CSSProperties}
    >
      {cells.map((row, r) => (
        <div key={r} role="row" className={styles.row}>
          {row.map((cell, c) => {
            if (cell.kind === 'corner') {
              return <div key={c} role="presentation" aria-hidden="true" className={styles.corner} />;
            }
            if (cell.kind === 'gutter') {
              return (
                <div
                  key={c}
                  role="gridcell"
                  aria-readonly="true"
                  aria-label={gutterLabel(cell.side, cell.index)}
                  className={`${styles.gutter} ${styles[cell.side]}`}
                />
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
