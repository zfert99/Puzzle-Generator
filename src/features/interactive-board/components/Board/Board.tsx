'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { KeyboardEvent, CSSProperties } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useBoardStore } from '../../store/useBoardStore';
import { Cell, ClueCell } from './Cell';
import { CageOverlay } from './CageOverlay';
import { BoardAnnouncer } from './BoardAnnouncer';
import { kakuroTracks } from '../../kakuro-board';
import styles from './Board.module.css';

/**
 * The interactive grid. Renders `size × size` cells as a CSS Grid and owns a single
 * centralized `keydown` handler (WAI-ARIA grid pattern): arrow keys move the
 * selection with a roving tabindex, digit keys enter values, Backspace/Delete clears,
 * and Space toggles pencil mode. Arrow/Space defaults are suppressed to stop the page
 * scrolling. Focus follows the selected cell so screen-reader users always hear the
 * active square. Before any selection exists, the first editable cell holds the
 * grid's Tab stop (WCAG 2.1.1) — see `entryIndex` below.
 */
export function Board() {
  const gridRef = useRef<HTMLDivElement>(null);

  const { size, maxNum, selectedR, selectedC, variant, cages, blocked, clues, entryIndex } = useBoardStore(
    useShallow((s) => ({
      size: s.config.size,
      maxNum: s.config.maxNum,
      selectedR: s.selectedCell?.r ?? null,
      selectedC: s.selectedCell?.c ?? null,
      variant: s.variant,
      cages: s.cages,
      blocked: s.blocked,
      clues: s.clues,
      // Roving-tabindex seed: with no selection yet, no cell is `tabIndex 0`, so Tab
      // would skip the grid entirely and a keyboard-only player could never start
      // (WCAG 2.1.1). Until the first selection, the first editable cell holds the
      // grid's single Tab stop; -1 once a selection owns it.
      entryIndex:
        s.selectedCell == null
          ? Math.max(0, s.givens.flat().findIndex((given) => !given))
          : -1,
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

  const isKakuro = variant === 'kakuro';

  /**
   * Arrow-key movement. Sudoku-family grids clamp at the edge. A Kakuro additionally skips its
   * black cells — they are not selectable — continuing in the same direction until a white cell
   * or the edge; with nothing fillable that way the selection stays put rather than landing on
   * a block. With no selection yet, the entry cell (the first fillable one) is selected.
   */
  const move = useCallback(
    (dr: number, dc: number) => {
      if (selectedR == null || selectedC == null) {
        selectCell(Math.floor(entryIndex / size), entryIndex % size);
        return;
      }
      let r = selectedR + dr;
      let c = selectedC + dc;
      while (r >= 0 && r < size && c >= 0 && c < size) {
        if (!isKakuro || !blocked[r]?.[c]) {
          selectCell(r, c);
          return;
        }
        r += dr;
        c += dc;
      }
    },
    [selectedR, selectedC, size, isKakuro, blocked, entryIndex, selectCell]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          move(-1, 0);
          return;
        case 'ArrowDown':
          e.preventDefault();
          move(1, 0);
          return;
        case 'ArrowLeft':
          e.preventDefault();
          move(0, -1);
          return;
        case 'ArrowRight':
          e.preventDefault();
          move(0, 1);
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

      // Digit entry (1..maxNum — the grid size for the Sudoku family, always 9 for Kakuro).
      if (/^[1-9]$/.test(e.key)) {
        const digit = Number(e.key);
        if (digit <= maxNum) {
          e.preventDefault();
          inputDigit(digit);
        }
      }
    },
    [move, maxNum, inputDigit, clearCell, togglePencilMode]
  );

  // Kakuro draws one extra track per axis: the clue gutter along the top and left (plan
  // decision D2 — the gutter is a rendering concern, so the store's grid stays `size × size`).
  const tracks = isKakuro ? kakuroTracks(size) : size;

  return (
    <>
      <div
        ref={gridRef}
        role="grid"
        aria-label={isKakuro ? 'Kakuro board' : 'Sudoku board'}
        className={styles.board}
        data-variant={variant}
        data-size={size}
        style={{ '--size': tracks } as CSSProperties}
        onKeyDown={handleKeyDown}
      >
        {/*
          The ARIA grid pattern requires role="row" between grid and gridcell (QA finding F6) —
          without it, screen readers cannot announce row position or navigate by row. The row
          divs are `display: contents` (styles.row) so the cells stay direct CSS-grid items and
          the layout is untouched; the rows exist only in the accessibility tree.
        */}
        {isKakuro && (
          <div role="row" aria-rowindex={1} className={styles.row}>
            {Array.from({ length: tracks }, (_, dc) => (
              <ClueCell key={`gutter-${dc}`} clue={clues[dc]} colIndex={dc + 1} />
            ))}
          </div>
        )}
        {Array.from({ length: size }, (_, r) => (
          <div key={`row-${r}`} role="row" aria-rowindex={isKakuro ? r + 2 : r + 1} className={styles.row}>
            {isKakuro && <ClueCell clue={clues[(r + 1) * tracks]} colIndex={1} />}
            {Array.from({ length: size }, (_, c) => (
              <Cell key={`${r}-${c}`} r={r} c={c} isEntry={entryIndex === r * size + c} />
            ))}
          </div>
        ))}
        {variant !== 'classic' && cages.length > 0 && <CageOverlay cages={cages} size={size} />}
      </div>
      <BoardAnnouncer />
    </>
  );
}
