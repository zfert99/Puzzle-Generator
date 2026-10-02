'use client';

import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { clueFlatIndex, type GutterSide } from '@/features/engine/skyscrapers/skyscrapers-types';
import { useBoardStore } from '../../store/useBoardStore';
import { describeSkyscraperClue, skyscraperClueState } from '../../skyscrapers-board';
import styles from './Board.module.css';

interface Props {
  side: GutterSide;
  index: number;
  /** The 1-based column a screen reader counts for this cell in its row. */
  colIndex: number;
}

/**
 * One Skyscrapers edge clue. It subscribes to ONLY its own line: the clue value, the
 * open / satisfied / violated verdict read from the filled prefix of that line (plan decision
 * D9 — Tatham's rule, provable violations only, never a red flash mid-line), and its "marked
 * done" flag. Judging one line is O(N); the 4N clue cells together cost O(N²) per keystroke,
 * which is the same order as the N² play cells (INP, AGENTS.md §3).
 *
 * Read-only in the ARIA sense (it holds no digit) but interactive: click or Enter/Space toggles
 * the grey "done" mark — the Brainbashers / Tatham / puzzle-skyscrapers convention that
 * doubles as a progress tracker for assistive technology. Drawn error > done > normal
 * (`towers.c`), so a wrongly marked-done clue still shows its violation. Outside the roving
 * tab order; the board's `C` key moves focus here and arrow keys walk the gutter.
 */
export const SkyscraperClueCell = memo(function SkyscraperClueCell({ side, index, colIndex }: Props) {
  const { clue, status, done } = useBoardStore(
    useShallow((s) => {
      const size = s.config.size;
      // `edgeClues` is persisted (never derived), but a rehydrating store can hand a cell a
      // `variant` one tick before the puzzle fields — render blank for that tick, never throw.
      const { clue, status } = s.edgeClues
        ? skyscraperClueState(s.edgeClues, s.grid, side, index)
        : { clue: 0, status: 'open' as const };
      return { clue, status, done: s.doneClues[clueFlatIndex(side, index, size)] ?? false };
    })
  );
  const toggleClueDone = useBoardStore((s) => s.toggleClueDone);

  const classes = [styles.cell, styles.gutterCell];
  if (clue > 0) {
    if (status === 'violated') classes.push(styles.clueViolated);
    else if (done) classes.push(styles.clueDone);
    else if (status === 'satisfied') classes.push(styles.clueSatisfied);
  }

  return (
    <div
      role="gridcell"
      aria-label={describeSkyscraperClue(side, index, clue, status, done)}
      aria-readonly
      aria-colindex={colIndex}
      data-clue={clue > 0 ? `${side}-${index}` : undefined}
      data-status={clue > 0 ? status : undefined}
      tabIndex={-1}
      className={classes.join(' ')}
      onClick={clue > 0 ? () => toggleClueDone(side, index) : undefined}
    >
      {clue > 0 ? clue : null}
    </div>
  );
});
