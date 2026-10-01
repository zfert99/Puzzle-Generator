import type { CSSProperties } from 'react';
import styles from './KakuroBoard.module.css';

const WHITE = '.';

/** On a block, `across` / `down` mean a run starts immediately to its right / below it. */
type DisplayCell =
  | { kind: 'white' }
  | { kind: 'block'; across: boolean; down: boolean };

/**
 * Expands an interior N×N layout into the (N+1)×(N+1) picture a player sees: a one-cell clue
 * gutter along the top and left (plan decision D2), plus the interior itself. Display index 0
 * on either axis is the gutter, so display (r, c) is interior (r − 1, c − 1).
 *
 * A black cell is marked as a clue cell when a white cell sits directly right of it (an across
 * run starts there) or directly below it (a down run starts there). That is a drawing decision
 * only — which black cells get the diagonal — not the run derivation V1 will own.
 */
function buildDisplayCells(layout: readonly string[]): DisplayCell[][] {
  const tracks = layout.length + 1;
  const isWhite = (r: number, c: number) => r >= 1 && c >= 1 && layout[r - 1]?.[c - 1] === WHITE;

  return Array.from({ length: tracks }, (_, r) =>
    Array.from({ length: tracks }, (_, c): DisplayCell =>
      isWhite(r, c)
        ? { kind: 'white' }
        : { kind: 'block', across: isWhite(r, c + 1), down: isWhite(r + 1, c) }
    )
  );
}

function cellLabel(cell: DisplayCell, r: number, c: number): string {
  if (cell.kind === 'white') return `Row ${r}, column ${c}, empty`;
  return cell.across || cell.down ? 'Clue cell' : 'Blocked cell';
}

/**
 * The looks-only Kakuro board (plan slice V0): draws a layout's white cells, black cells and
 * diagonal-split clue cells, and nothing else — no sums, no selection, no input. A Server
 * Component on purpose: there is no state to own yet, and the layout is static data, so there
 * is no hydration concern. V2 replaces this with the interactive board on `useBoardStore`.
 *
 * It already carries the WAI-ARIA grid skeleton (grid → row → gridcell, read-only) because V2
 * needs exactly that structure and it costs nothing to draw it right the first time.
 */
export function KakuroBoard({ layout }: { layout: readonly string[] }) {
  const cells = buildDisplayCells(layout);

  return (
    <div
      role="grid"
      aria-label="Kakuro board"
      aria-readonly="true"
      className={styles.board}
      style={{ '--tracks': cells.length } as CSSProperties}
    >
      {cells.map((row, r) => (
        <div key={r} role="row" className={styles.row}>
          {row.map((cell, c) => (
            <div
              key={c}
              role="gridcell"
              aria-label={cellLabel(cell, r, c)}
              className={
                cell.kind === 'white'
                  ? styles.cell
                  : `${styles.cell} ${styles.block} ${cell.across || cell.down ? styles.clue : ''}`
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}
