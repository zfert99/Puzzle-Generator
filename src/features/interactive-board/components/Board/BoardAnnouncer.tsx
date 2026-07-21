'use client';

import { useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { useSetting } from '@/features/settings/useSettings';

/**
 * Screen-reader announcer for board changes (WCAG 4.1.3, per
 * `Docs/research/accessibility-responsive-qa.md`). When a digit is typed, focus stays on the
 * cell, so a screen reader announces nothing on its own — this visually-hidden `aria-live`
 * region fills that gap by diffing the grid and announcing what changed ("5 entered, row 3
 * column 4", "cell cleared", "puzzle solved"). Correctness is only spoken when the player has
 * mistake-highlighting on, so it mirrors the visual cue rather than overriding their choice.
 *
 * Diffing in the component (not the store) keeps the store free of settings knowledge and
 * needs no new action wiring.
 */
export function BoardAnnouncer() {
  const grid = useBoardStore((s) => s.grid);
  const solution = useBoardStore((s) => s.solution);
  const status = useBoardStore((s) => s.status);
  const errorHighlight = useSetting('errorHighlight');
  // Track the previous grid/status in STATE (not a ref) so we can derive the announcement
  // during render — React's sanctioned "adjust state when a value changed since last render"
  // pattern, which avoids a setState-in-effect cascade.
  const [prevGrid, setPrevGrid] = useState(grid);
  const [prevStatus, setPrevStatus] = useState(status);
  const [message, setMessage] = useState('');

  if (status !== prevStatus) {
    setPrevStatus(status);
    if (status === 'solved') setMessage('Puzzle solved');
  }
  if (grid !== prevGrid) {
    const before = prevGrid;
    setPrevGrid(grid);
    // Skip a grid-size change (a new game) — nothing to diff.
    if (before.length === grid.length) {
      const next = describeChange(grid, before, solution, errorHighlight);
      if (next && next !== message) setMessage(next);
    }
  }

  return (
    <div aria-live="polite" className="sr-only">
      {message}
    </div>
  );
}

/** The first differing cell, described for a screen reader — or `null` if nothing changed. */
function describeChange(
  grid: number[][],
  before: number[][],
  solution: number[][],
  errorHighlight: boolean,
): string | null {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid.length; c++) {
      if (grid[r][c] === before[r][c]) continue;
      const value = grid[r][c];
      const pos = `row ${r + 1}, column ${c + 1}`;
      if (value === 0) return `Cleared ${pos}`;
      const wrong = errorHighlight && solution.length > 0 && value !== solution[r][c];
      return `${value} entered, ${pos}${wrong ? ', incorrect' : ''}`;
    }
  }
  return null;
}
