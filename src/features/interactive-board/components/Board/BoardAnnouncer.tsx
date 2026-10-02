'use client';

import { useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { useSetting } from '@/features/settings/useSettings';
import { clueFromFlatIndex } from '@/features/engine/skyscrapers/skyscrapers-types';
import { describeSkyscraperClue, skyscraperClueState } from '../../skyscrapers-board';

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
  const isDaily = useBoardStore((s) => s.mode === 'daily');
  const errorsRevealed = useBoardStore((s) => s.errorsRevealed);
  const doneClues = useBoardStore((s) => s.doneClues);
  const edgeClues = useBoardStore((s) => s.edgeClues);
  const size = useBoardStore((s) => s.config.size);
  const errorHighlightSetting = useSetting('errorHighlight');
  // Match the visual rule: on a daily, "incorrect" is only announced once the player opts in
  // via the review modal's reveal; in free play it follows the app-wide setting.
  const announceWrong = isDaily ? errorsRevealed : errorHighlightSetting;
  // Track the previous grid/status in STATE (not a ref) so we can derive the announcement
  // during render — React's sanctioned "adjust state when a value changed since last render"
  // pattern, which avoids a setState-in-effect cascade.
  const [prevGrid, setPrevGrid] = useState(grid);
  const [prevStatus, setPrevStatus] = useState(status);
  const [prevDone, setPrevDone] = useState(doneClues);
  const [prevClues, setPrevClues] = useState(edgeClues);
  const [message, setMessage] = useState('');

  // The solving move changes `status` and `grid` in the same update. Both diffs below run in
  // this one render, and the LAST `setMessage` wins — so "Puzzle solved" used to be overwritten
  // by "7 entered, row 9, column 9" and was never heard. The solve outranks the placement.
  let justSolved = false;
  if (status !== prevStatus) {
    setPrevStatus(status);
    if (status === 'solved') {
      setMessage('Puzzle solved');
      justSolved = true;
    }
  }
  // Marking a Skyscrapers clue done changes the focused cell's own name, which screen readers do
  // not re-announce on their own (G8) — say the clue's new name here. A new game resets every
  // flag at once (and swaps the clues), which is not a mark: `edgeClues` changes with the game,
  // so that render only re-bases the diff.
  const gameChanged = edgeClues !== prevClues;
  if (gameChanged) setPrevClues(edgeClues);
  if (doneClues !== prevDone) {
    const before = prevDone;
    setPrevDone(doneClues);
    if (edgeClues && !gameChanged && before.length === doneClues.length) {
      const flat = doneClues.findIndex((done, i) => done !== before[i]);
      if (flat !== -1) {
        const { side, index } = clueFromFlatIndex(flat, size);
        const { clue, status } = skyscraperClueState(edgeClues, grid, side, index);
        const next = describeSkyscraperClue(side, index, clue, status, doneClues[flat]);
        if (next !== message) setMessage(next);
      }
    }
  }
  if (grid !== prevGrid) {
    const before = prevGrid;
    setPrevGrid(grid);
    // Skip a grid-size change (a new game) — nothing to diff — and the solving move (announced
    // above as the solve itself).
    if (before.length === grid.length && !justSolved) {
      const next = describeChange(grid, before, solution, announceWrong);
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
