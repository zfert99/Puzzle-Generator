'use client';

import { useMemo } from 'react';
import { computeCageOutline } from '@/features/engine/killer/cage-geometry';
import type { Cage } from '@/features/engine/killer/killer-types';
import styles from './Board.module.css';

/**
 * Killer cage layer — an SVG overlaid exactly on the board grid, drawing the dashed cage outlines
 * and corner sum labels from the shared `computeCageOutline` geometry (same as the PDF). Uses a
 * `0..size` viewBox so cell-unit coordinates map straight in; `pointer-events: none` so cell
 * clicks pass through. Decorative → `aria-hidden` (the numeric sums are exposed on the cells).
 */
export function CageOverlay({ cages, size }: { cages: Cage[]; size: number }) {
  const { lines, sums } = useMemo(() => computeCageOutline(cages, size), [cages, size]);

  return (
    <svg
      className={styles.cageOverlay}
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {lines.map((l, i) => (
        <line key={`l${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
      ))}
      {sums.map((s, i) => (
        <text key={`s${i}`} x={s.col + 0.09} y={s.row + 0.3} fontSize={0.24} className={styles.cageSum}>
          {s.value}
        </text>
      ))}
    </svg>
  );
}
