'use client';

import { useShallow } from 'zustand/react/shallow';
import { useBoardStore } from '../../store/useBoardStore';
import { maskToDigits } from '../../board-utils';
import styles from './Board.module.css';

interface CellProps {
  r: number;
  c: number;
}

/**
 * A single board square. It subscribes via `useShallow` to ONLY the booleans/values
 * that affect its own render (value, candidates, given, selected, peer, error) — so
 * moving the selection re-renders just the cells whose flags actually change, not the
 * whole grid. This granular subscription is what keeps input latency (INP) low.
 */
export function Cell({ r, c }: CellProps) {
  const { value, mask, isGiven, isSelected, isPeer, isError, size, boxWidth, boxHeight } = useBoardStore(
    useShallow((s) => {
      const sel = s.selectedCell;
      const cfg = s.config;
      const samePeer =
        sel != null &&
        !(sel.r === r && sel.c === c) &&
        (sel.r === r ||
          sel.c === c ||
          (Math.floor(sel.r / cfg.boxHeight) === Math.floor(r / cfg.boxHeight) &&
            Math.floor(sel.c / cfg.boxWidth) === Math.floor(c / cfg.boxWidth)));
      const v = s.grid[r][c];
      return {
        value: v,
        mask: s.candidates[r][c],
        isGiven: s.givens[r][c],
        isSelected: sel?.r === r && sel?.c === c,
        isPeer: samePeer,
        isError: s.realTimeErrors && v !== 0 && !s.givens[r][c] && v !== s.solution[r][c],
        size: cfg.size,
        boxWidth: cfg.boxWidth,
        boxHeight: cfg.boxHeight,
      };
    })
  );

  const selectCell = useBoardStore((s) => s.selectCell);

  const thickRight = (c + 1) % boxWidth === 0 && c + 1 !== size;
  const thickBottom = (r + 1) % boxHeight === 0 && r + 1 !== size;

  const className = [
    styles.cell,
    isGiven && styles.given,
    isSelected && styles.selected,
    !isSelected && isPeer && styles.peer,
    isError && styles.error,
    thickRight && styles.thickRight,
    thickBottom && styles.thickBottom,
  ]
    .filter(Boolean)
    .join(' ');

  const candidates = value === 0 ? maskToDigits(mask) : [];

  const ariaLabel = (() => {
    const pos = `row ${r + 1}, column ${c + 1}`;
    if (value !== 0) return `${isGiven ? 'Given clue' : 'Value'} ${value}, ${pos}`;
    if (candidates.length) return `Candidates ${candidates.join(', ')}, ${pos}`;
    return `Empty, ${pos}`;
  })();

  return (
    <div
      role="gridcell"
      aria-label={ariaLabel}
      aria-selected={isSelected}
      aria-readonly={isGiven || undefined}
      data-index={r * size + c}
      tabIndex={isSelected ? 0 : -1}
      className={className}
      onClick={() => selectCell(r, c)}
    >
      {value !== 0 ? (
        value
      ) : candidates.length ? (
        <div className={styles.candidates} aria-hidden="true">
          {Array.from({ length: size }, (_, i) => (
            <span key={i}>{mask & (1 << i) ? i + 1 : ''}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
