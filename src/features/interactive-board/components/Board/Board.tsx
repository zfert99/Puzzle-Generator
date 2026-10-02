'use client';

import { memo, useEffect, useRef, useCallback } from 'react';
import type { KeyboardEvent, CSSProperties } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useBoardStore } from '../../store/useBoardStore';
import { Cell, ClueCell } from './Cell';
import { SkyscraperClueCell } from './SkyscraperClueCell';
import { CageOverlay } from './CageOverlay';
import { BoardAnnouncer } from './BoardAnnouncer';
import { kakuroTracks } from '../../kakuro-board';
import { skyscrapersTracks } from '@/features/engine/skyscrapers/skyscrapers-types';
import type { GutterSide } from '@/features/engine/skyscrapers/skyscrapers-types';
import styles from './Board.module.css';

/**
 * The interactive grid. Renders `size × size` cells as a CSS Grid and owns a single
 * centralized `keydown` handler (WAI-ARIA grid pattern): arrow keys move the
 * selection with a roving tabindex, digit keys enter values, Backspace/Delete clears,
 * and Space toggles pencil mode. Arrow/Space defaults are suppressed to stop the page
 * scrolling. Focus follows the selected cell so screen-reader users always hear the
 * active square. Before any selection exists, the first editable cell holds the
 * grid's Tab stop (WCAG 2.1.1) — see `entryIndex` below.
 *
 * `memo`'d with no props: the Experience components that render it re-render once a second on
 * the timer (they read the clock for their own chrome), and without memo each tick re-ran this
 * component's N² `Cell` element creations and the cage overlay diff. Its store slice is still
 * what re-renders it on a real change.
 */
export const Board = memo(function Board() {
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
  const toggleClueDone = useBoardStore((s) => s.toggleClueDone);

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
      if (key !== 'z' && key !== 'y') return;
      // A window-level listener fires behind any open dialog (the rules, settings, "Not quite!"
      // and confirm modals) and while the board is paused and hidden — neither is a moment to
      // change the grid. Only a live, visible game takes the shortcut; inside a dialog the key
      // is left alone so a text field's own undo still works.
      if (useBoardStore.getState().status !== 'playing') return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('[role="dialog"], dialog[open]')) return;
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
  const isSkyscrapers = variant === 'skyscrapers';

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

  /**
   * Skyscrapers clue navigation (plan decision D9). The gutter is outside the roving tab order,
   * so a keyboard player reaches it with `C`: focus lands on the first clue, arrow keys walk the
   * clues in reading order (top, bottom, left, right — DOM order), Enter/Space toggles "done",
   * and `C` or Escape returns to the selected play cell. While a clue has focus the play-cell
   * keys are not applied, so a digit cannot land on the board by accident.
   */
  const clueNodes = useCallback(
    () => Array.from(gridRef.current?.querySelectorAll<HTMLElement>('[data-clue]') ?? []),
    []
  );
  const handleClueKeys = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): boolean => {
      if (!isSkyscrapers) return false;
      const active = document.activeElement as HTMLElement | null;
      const onClue = active?.dataset.clue != null && gridRef.current?.contains(active);
      // Bare `C` only — Ctrl/Cmd+C must stay copy (the undo shortcut makes the same distinction).
      if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (onClue) {
          const back = gridRef.current?.querySelector<HTMLElement>('[data-index][tabindex="0"]');
          back?.focus();
        } else {
          clueNodes()[0]?.focus();
        }
        return true;
      }
      if (!onClue) return false;
      const nodes = clueNodes();
      const at = nodes.indexOf(active as HTMLElement);
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          nodes[Math.min(at + 1, nodes.length - 1)]?.focus();
          return true;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          nodes[Math.max(at - 1, 0)]?.focus();
          return true;
        case 'Enter':
        case ' ': {
          e.preventDefault();
          const [side, index] = (active as HTMLElement).dataset.clue!.split('-');
          toggleClueDone(side as GutterSide, Number(index));
          return true;
        }
        case 'Escape': {
          e.preventDefault();
          const back = gridRef.current?.querySelector<HTMLElement>('[data-index][tabindex="0"]');
          back?.focus();
          return true;
        }
      }
      return true; // any other key on a clue cell is swallowed, never applied to the board
    },
    [isSkyscrapers, clueNodes, toggleClueDone]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (handleClueKeys(e)) return;
      // Modified keys are the browser's, not the board's: Cmd/Ctrl+1–9 switch tabs, Cmd/Ctrl+0
      // resets zoom, Cmd/Ctrl+P prints. Treating them as digit entry both planted digits and
      // swallowed the shortcut. (Undo/redo have their own window listener above.)
      if (e.metaKey || e.ctrlKey || e.altKey) return;
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
    [handleClueKeys, move, maxNum, inputDigit, clearCell, togglePencilMode]
  );

  // Kakuro draws one extra track per axis: the clue gutter along the top and left (plan
  // decision D2 — the gutter is a rendering concern, so the store's grid stays `size × size`).
  // Skyscrapers draws two: a clue gutter on all four sides, with dead corners.
  const tracks = isKakuro ? kakuroTracks(size) : isSkyscrapers ? skyscrapersTracks(size) : size;
  // How many display rows precede interior row 0, and display columns precede interior column 0.
  const offset = isKakuro || isSkyscrapers ? 1 : 0;
  // A corner is a real cell of the grid for assistive technology (L5) and says so — an unnamed
  // gridcell is read as silence or "blank", which a listener cannot tell from a blank clue.
  const corner = (col: number) => <div role="gridcell" aria-label="Corner" aria-readonly aria-colindex={col} className={styles.gutterCell} />;
  const gutterRow = (side: GutterSide, rowIndex: number) => (
    <div role="row" aria-rowindex={rowIndex} className={styles.row}>
      {corner(1)}
      {Array.from({ length: size }, (_, c) => (
        <SkyscraperClueCell key={`${side}-${c}`} side={side} index={c} colIndex={c + 2} />
      ))}
      {corner(tracks)}
    </div>
  );

  return (
    <>
      <div
        ref={gridRef}
        role="grid"
        aria-label={isKakuro ? 'Kakuro board' : isSkyscrapers ? 'Skyscrapers board' : 'Sudoku board'}
        aria-describedby={isSkyscrapers ? 'skyscrapers-gutter-help' : undefined}
        aria-rowcount={tracks}
        aria-colcount={tracks}
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
        {isSkyscrapers && gutterRow('top', 1)}
        {Array.from({ length: size }, (_, r) => (
          <div key={`row-${r}`} role="row" aria-rowindex={r + 1 + offset} className={styles.row}>
            {isKakuro && <ClueCell clue={clues[(r + 1) * tracks]} colIndex={1} />}
            {isSkyscrapers && <SkyscraperClueCell side="left" index={r} colIndex={1} />}
            {Array.from({ length: size }, (_, c) => (
              <Cell key={`${r}-${c}`} r={r} c={c} isEntry={entryIndex === r * size + c} />
            ))}
            {isSkyscrapers && <SkyscraperClueCell side="right" index={r} colIndex={tracks} />}
          </div>
        ))}
        {isSkyscrapers && gutterRow('bottom', tracks)}
        {variant !== 'classic' && cages.length > 0 && <CageOverlay cages={cages} size={size} />}
      </div>
      {/* The gutter is outside the Tab order (D9), so the way in has to be told, not found: the
          grid's description names it for a screen reader on focus (G8). */}
      {isSkyscrapers && (
        <p id="skyscrapers-gutter-help" className="sr-only">
          Clues sit outside the grid on all four sides. Press C to move to the clues, arrow keys to move between
          them, Enter or Space to mark a clue done, and C or Escape to return to the board.
        </p>
      )}
      <BoardAnnouncer />
    </>
  );
});
