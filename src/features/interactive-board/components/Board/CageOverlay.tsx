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
      {/* Sums tucked into the anchor cell's top-left corner, PDF-style: a small cell-background
          pad sits behind each so the number breaks the dashed cage line instead of colliding
          with it. Pad width estimated from the mono font (~0.13 cell-units per digit). */}
      {sums.map((s, i) => (
        <g key={`s${i}`}>
          <rect
            x={s.col + 0.025}
            y={s.row + 0.025}
            width={0.13 * String(s.value).length + 0.04}
            height={0.21}
            className={styles.cageSumPad}
          />
          <text x={s.col + 0.045} y={s.row + 0.21} fontSize={0.2} className={styles.cageSum}>
            {s.value}
          </text>
        </g>
      ))}
    </svg>
  );
}
