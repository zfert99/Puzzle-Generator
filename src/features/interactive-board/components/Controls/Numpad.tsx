'use client';

import { memo } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { useBoardStore } from '../../store/useBoardStore';
import { Calculator } from '../Calculator';

/**
 * On-screen controls for mouse/touch users: a digit pad plus Erase, an
 * `aria-pressed` Pencil toggle, Hint, and Undo/Redo. Undo/Redo call into zundo's
 * temporal store directly (its history lives beside the main store), and their
 * disabled state subscribes reactively to that store's past/future stacks.
 *
 * `showHint` defaults to true (free play). The daily passes `false` — a competitive,
 * one-attempt ranked puzzle shouldn't hand out answers.
 *
 * `memo`'d (one stable boolean prop) for the same reason as `Board`: the Experiences re-render
 * on every timer tick, and this pad's per-digit lockout scan has no reason to run with them.
 */
export const Numpad = memo(function Numpad({ showHint = true }: { showHint?: boolean }) {
  // The digit range is `maxNum`, not `size`: they agree for Sudoku/Killer/Keisan, but a Kakuro
  // takes 1–9 whatever its size.
  const maxNum = useBoardStore((s) => s.config.maxNum);
  const isKiller = useBoardStore((s) => s.variant === 'killer');
  const pencilMode = useBoardStore((s) => s.pencilMode);
  // Undo/redo only on a live board — a paused game hides the grid, and a move made behind the
  // "Paused" placeholder is one the player cannot see.
  const isPlaying = useBoardStore((s) => s.status === 'playing');
  // Which digits have all `size` instances placed (locked out). Never for Kakuro: with no house
  // constraint there is no global per-digit count, so a digit is always available.
  const completed = useBoardStore(
    useShallow((s) => {
      const counts = new Array<number>(s.config.maxNum).fill(0);
      for (const row of s.grid) for (const v of row) if (v > 0) counts[v - 1]++;
      return counts.map((n) => s.variant !== 'kakuro' && n >= s.config.size);
    })
  );
  const inputDigit = useBoardStore((s) => s.inputDigit);
  const clearCell = useBoardStore((s) => s.clearCell);
  const togglePencilMode = useBoardStore((s) => s.togglePencilMode);
  const hint = useBoardStore((s) => s.hint);

  const canUndo = useStore(useBoardStore.temporal, (s) => s.pastStates.length > 0) && isPlaying;
  const canRedo = useStore(useBoardStore.temporal, (s) => s.futureStates.length > 0) && isPlaying;

  const undo = () => useBoardStore.temporal.getState().undo();
  const redo = () => useBoardStore.temporal.getState().redo();

  const controlClass = 'tap-target py-2 rounded-lg bg-paper border-2 border-ink hover:bg-paper-2 text-sm transition-colors disabled:opacity-40 disabled:hover:bg-paper';

  return (
    <div className="mt-6 w-full max-w-[520px] mx-auto flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: maxNum }, (_, i) => i + 1).map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={completed[digit - 1]}
            onClick={() => inputDigit(digit)}
            className="py-3 rounded-lg bg-paper border-2 border-ink hover:bg-paper-2 text-lg font-semibold transition-colors disabled:opacity-30 disabled:hover:bg-paper disabled:cursor-not-allowed"
          >
            {digit}
          </button>
        ))}
      </div>

      <div
        className={`grid ${
          showHint && isKiller ? 'grid-cols-6' : showHint || isKiller ? 'grid-cols-5' : 'grid-cols-4'
        } gap-2`}
      >
        <button type="button" onClick={() => clearCell()} className={controlClass}>
          Erase
        </button>
        <button
          type="button"
          aria-pressed={pencilMode}
          aria-label="Pencil marks"
          title="Pencil marks"
          onClick={() => togglePencilMode()}
          className={`tap-target py-2 rounded-lg text-sm transition-colors ${
            pencilMode ? 'bg-butterscotch text-on-butterscotch' : 'bg-paper border-2 border-ink hover:bg-paper-2'
          }`}
        >
          ✏️
        </button>
        {showHint && (
          <button type="button" onClick={() => hint()} className={controlClass}>
            Hint
          </button>
        )}
        <button type="button" onClick={undo} disabled={!canUndo} className={controlClass}>
          Undo
        </button>
        <button type="button" onClick={redo} disabled={!canRedo} className={controlClass}>
          Redo
        </button>
        {/* Killer only — cage-sum arithmetic is worth having a calculator for. */}
        {isKiller && <Calculator />}
      </div>
    </div>
  );
});
