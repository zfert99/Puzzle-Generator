'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { KeyboardEvent, CSSProperties } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useBoardStore } from '../../store/useBoardStore';
import { Cell } from './Cell';
import { CageOverlay } from './CageOverlay';
import { BoardAnnouncer } from './BoardAnnouncer';
import styles from './Board.module.css';

/**
 * The interactive grid. Renders `size × size` cells as a CSS Grid and owns a single
 * centralized `keydown` handler (WAI-ARIA grid pattern): arrow keys move the
 * selection with a roving tabindex, digit keys enter values, Backspace/Delete clears,
 * and Space toggles pencil mode. Arrow/Space defaults are suppressed to stop the page
 * scrolling. Focus follows the selected cell so screen-reader users always hear the
 * active square.
 */
export function Board() {
  const gridRef = useRef<HTMLDivElement>(null);

  const { size, selectedR, selectedC, variant, cages } = useBoardStore(
    useShallow((s) => ({
      size: s.config.size,
      selectedR: s.selectedCell?.r ?? null,
      selectedC: s.selectedCell?.c ?? null,
      variant: s.variant,
      cages: s.cages,
    }))
  );

  const selectCell = useBoardStore((s) => s.selectCell);
  const inputDigit = useBoardStore((s) => s.inputDigit);
  const clearCell = useBoardStore((s) => s.clearCell);
  const togglePencilMode = useBoardStore((s) => s.togglePencilMode);

  // Roving tabindex: keep DOM focus on the selected cell.
  useEffect(() => {
    if (selectedR == null || selectedC == null) return;
    const node = gridRef.current?.querySelector<HTMLElement>(`[data-index="${selectedR * size + selectedC}"]`);
    node?.focus();
  }, [selectedR, selectedC, size]);

  // Undo/redo shortcuts, at the window level so they work regardless of which
  // control currently has focus: Cmd/Ctrl+Z (undo), Shift+Cmd/Ctrl+Z or Ctrl+Y
  // (redo). Requires a modifier, so ordinary typing is never affected.
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      const temporal = useBoardStore.temporal.getState();

      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) temporal.redo();
        else temporal.undo();
      } else if (key === 'y') {
        e.preventDefault();
        temporal.redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const r = selectedR ?? 0;
      const c = selectedC ?? 0;
      const hasSelection = selectedR != null && selectedC != null;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          selectCell(hasSelection ? Math.max(0, r - 1) : 0, c);
          return;
        case 'ArrowDown':
          e.preventDefault();
          selectCell(hasSelection ? Math.min(size - 1, r + 1) : 0, c);
          return;
        case 'ArrowLeft':
          e.preventDefault();
          selectCell(r, hasSelection ? Math.max(0, c - 1) : 0);
          return;
        case 'ArrowRight':
          e.preventDefault();
          selectCell(r, hasSelection ? Math.min(size - 1, c + 1) : 0);
          return;
        case 'Backspace':
        case 'Delete':
        case '0':
          e.preventDefault();
          clearCell();
          return;
        case ' ':
        case 'p':
        case 'P':
          e.preventDefault();
          togglePencilMode();
          return;
      }

      // Digit entry (1..size).
      if (/^[1-9]$/.test(e.key)) {
        const digit = Number(e.key);
        if (digit <= size) {
          e.preventDefault();
          inputDigit(digit);
        }
      }
    },
    [selectedR, selectedC, size, selectCell, inputDigit, clearCell, togglePencilMode]
  );

  return (
    <>
      <div
        ref={gridRef}
        role="grid"
        aria-label="Sudoku board"
        className={styles.board}
        style={{ '--size': size } as CSSProperties}
        onKeyDown={handleKeyDown}
      >
        {Array.from({ length: size }, (_, r) =>
          Array.from({ length: size }, (_, c) => <Cell key={`${r}-${c}`} r={r} c={c} />)
        )}
        {variant === 'killer' && cages.length > 0 && <CageOverlay cages={cages} size={size} />}
      </div>
      <BoardAnnouncer />
    </>
  );
}
