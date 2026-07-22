'use client';

import { useId, useMemo } from 'react';
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
  // Unique per instance so two boards on the same page (unlikely today, but cheap insurance)
  // never share an <svg id>, which SVG `mask`/`url()` references resolve globally in the DOM.
  const maskId = `cage-sum-gaps-${useId()}`;

  return (
    <svg
      className={styles.cageOverlay}
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* Punches a real gap in the dashed cage line under each sum, rather than painting a
          background-colored pad over it. A painted pad has to pick ONE fixed color, which
          either fights the resting cell background (it did — a solid mismatched box on any
          highlighted cell) or, at partial opacity, lets the dashed line ghost through (still
          wrong, just less so). A mask has neither problem: nothing is drawn there at all, so
          whatever's actually showing on that cell — any highlight state, any theme — is simply
          what renders, correctly, without this component needing to know what it is. */}
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={size} height={size}>
          <rect x={0} y={0} width={size} height={size} fill="white" />
          {sums.map((s, i) => (
            <rect
              key={`gap${i}`}
              x={s.col + 0.025}
              y={s.row + 0.025}
              width={0.13 * String(s.value).length + 0.04}
              height={0.21}
              fill="black"
            />
          ))}
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        {lines.map((l, i) => (
          <line key={`l${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
        ))}
      </g>
      {/* Sums tucked into the anchor cell's top-left corner, PDF-style, at the same position
          as the mask gap above — no background rect needed here anymore. */}
      {sums.map((s, i) => (
        <text key={`s${i}`} x={s.col + 0.045} y={s.row + 0.21} fontSize={0.2} className={styles.cageSum}>
          {s.value}
        </text>
      ))}
    </svg>
  );
}
