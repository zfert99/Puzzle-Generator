'use client';

import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useBoardStore } from '../../store/useBoardStore';
import { useSetting } from '@/features/settings/useSettings';
import { maskToDigits } from '../../board-utils';
import { describeClue, shareRun, type BoardClue } from '../../kakuro-board';
import styles from './Board.module.css';

interface CellProps {
  r: number;
  c: number;
  /** This cell holds the grid's Tab stop before any selection exists (see Board's entryIndex). */
  isEntry: boolean;
}

/**
 * A single board square. It subscribes via `useShallow` to ONLY the booleans/values
 * that affect its own render (value, candidates, given, selected, peer, error) — so
 * moving the selection re-renders just the cells whose flags actually change, not the
 * whole grid. This granular subscription is what keeps input latency (INP) low.
 *
 * Wrapped in `React.memo`: `Board` re-renders on every selection change (its selector reads
 * the selected row/col), which re-creates all N² Cell elements. The props here are the stable
 * `{r, c}`, so memo lets React skip re-rendering the cells whose flags didn't change — only
 * the handful whose own store slice moved re-render (via their subscription). On a 9×9 that's
 * ~4–20 cells per keystroke instead of 81 (INP; `Docs/performance-audit.md`).
 */
export const Cell = memo(function Cell({ r, c, isEntry }: CellProps) {
  // Error highlighting is an app-wide setting (features/settings), not per-game.
  const errorHighlight = useSetting('errorHighlight');
  const { value, mask, isGiven, isSelected, isPeer, isCagePeer, isWrong, isSameNumber, candMatch, size, maxNum, boxWidth, boxHeight, hasBoxes, isDaily, errorsRevealed, isKakuro, isSkyscrapers, isBlocked, clue } = useBoardStore(
    useShallow((s) => {
      const sel = s.selectedCell;
      const cfg = s.config;
      const isSelf = sel != null && sel.r === r && sel.c === c;
      const isKakuro = s.variant === 'kakuro';
      const isSkyscrapers = s.variant === 'skyscrapers';
      // Kakuro: a black cell renders as a clue cell (see `ClueCell`) and takes no input. Its clue
      // is looked up by DISPLAY index — the on-screen grid has a gutter row/column before the
      // interior, so interior (r, c) is display (r + 1, c + 1) on a `size + 1`-track grid.
      // Optional access: `blocked`/`clues` are derived on rehydration and can lag `variant` by a
      // tick (the same window `resolvePeers` covers in the store) — a cell then renders white for
      // that tick instead of throwing on `undefined[c]`.
      const isBlocked = isKakuro && (s.blocked[r]?.[c] ?? false);
      const clue = isBlocked ? (s.clues[(r + 1) * (cfg.size + 1) + (c + 1)] ?? null) : null;
      // A Killer cage is a constraint region like a house, but a distinct one from
      // row/column/box — kept separate from `samePeer` so it can render its own tint
      // (`.cagePeer`) instead of blending into the generic peer highlight. O(1) via the
      // precomputed cellToCage map (empty for classic games).
      const sameCage =
        sel != null &&
        !isSelf &&
        s.cellToCage.length > 0 &&
        s.cellToCage[sel.r * cfg.size + sel.c] !== -1 &&
        s.cellToCage[sel.r * cfg.size + sel.c] === s.cellToCage[r * cfg.size + c];
      // Boxless (Latin-square-only) grids — KenKen at 5/7 — have no box, so a cell peers only
      // through its shared row/column; the box clause is gated off so it doesn't highlight
      // phantom box-mates.
      // Kakuro peers are run-mates, not row/column/box: O(1) via the precomputed `cellToRuns`
      // (two run ids per cell), the same shape of lookup `cellToCage` gives Killer — never a
      // scan of the selection's peer list inside every cell's selector.
      const samePeer =
        sel != null &&
        !isSelf &&
        (isKakuro
          ? shareRun(s.cellToRuns, sel.r * cfg.size + sel.c, r * cfg.size + c)
          : sel.r === r ||
            sel.c === c ||
            (cfg.hasBoxes &&
              Math.floor(sel.r / cfg.boxHeight) === Math.floor(r / cfg.boxHeight) &&
              Math.floor(sel.c / cfg.boxWidth) === Math.floor(c / cfg.boxWidth)));
      const v = s.grid[r][c];
      const selValue = sel != null ? s.grid[sel.r][sel.c] : 0;
      const mask = s.candidates[r][c];
      return {
        value: v,
        mask,
        isGiven: s.givens[r][c],
        isSelected: isSelf,
        isPeer: samePeer,
        isCagePeer: sameCage,
        isWrong: v !== 0 && !s.givens[r][c] && v !== s.solution[r][c],
        isSameNumber: v !== 0 && v === selValue && !isSelf, // another cell holding the selected value
        // The one pencil mark in THIS cell that matches the selected cell's placed value (0 if
        // none) — same-number's candidate-side twin. Resolved here, inside the selector, rather
        // than returning the raw selected value: a raw `selValue` changed for all N² cells every
        // time the selection moved between two different digits or a digit was typed, so every
        // cell re-rendered and the `React.memo` below was defeated on most moves. Reduced to the
        // digit-or-0 this cell actually draws, it only changes for the few cells that show it.
        candMatch: v === 0 && selValue !== 0 && (mask & (1 << (selValue - 1))) !== 0 ? selValue : 0,
        size: cfg.size,
        maxNum: cfg.maxNum,
        boxWidth: cfg.boxWidth,
        boxHeight: cfg.boxHeight,
        hasBoxes: cfg.hasBoxes,
        isDaily: s.mode === 'daily',
        errorsRevealed: s.errorsRevealed,
        isKakuro,
        isSkyscrapers,
        isBlocked,
        clue,
      };
    })
  );

  const selectCell = useBoardStore((s) => s.selectCell);

  // Kakuro's and Skyscrapers' display grids have a gutter column before the interior, so
  // interior column c is the (c + 2)th column a screen reader counts.
  const colIndex = isKakuro || isSkyscrapers ? c + 2 : c + 1;

  if (isBlocked) return <ClueCell clue={clue} colIndex={colIndex} />;

  // Boxless (Latin-square-only) grids draw no interior thick box borders (KenKen at 5/7).
  const thickRight = hasBoxes && (c + 1) % boxWidth === 0 && c + 1 !== size;
  const thickBottom = hasBoxes && (r + 1) % boxHeight === 0 && r + 1 !== size;

  // Dailies never highlight wrong cells during play by default (no hand-holding on the ranked
  // board) — unless the player opted into a reveal from the "Not quite!" review modal
  // (`errorsRevealed`), which overrides the daily gate but not the app-wide setting (an
  // explicit ask beats a passive default). Free play instead follows the `errorHighlight`
  // setting.
  const isError = isWrong && (isDaily ? errorsRevealed : errorHighlight);

  // One background wins, by precedence: error > selected > same-number > cage-peer > peer.
  // Errors take priority so a wrong value reads red even while it's the selected cell.
  // Cage membership outranks generic row/column/box peering since it's the rarer, more
  // specific constraint worth calling out with its own tint.
  const classes = [styles.cell];
  if (isGiven) classes.push(styles.given);
  if (isError) classes.push(styles.error);
  else if (isSelected) classes.push(styles.selected);
  else if (isSameNumber) classes.push(styles.sameNumber);
  else if (isCagePeer) classes.push(styles.cagePeer);
  else if (isPeer) classes.push(styles.peer);
  if (isSelected && isError) classes.push(styles.selectedRing); // still show selection on a red cell
  if (thickRight) classes.push(styles.thickRight);
  if (thickBottom) classes.push(styles.thickBottom);
  // Skyscrapers: the heavy frame belongs to the play area, not the board — the clue gutter sits
  // outside it (research §6: a bold outline around the N×N with plain digits outside). The
  // board's own border is turned off for this variant, so the edge cells draw it.
  if (isSkyscrapers) {
    if (r === 0) classes.push(styles.frameTop);
    if (r === size - 1) classes.push(styles.frameBottom);
    if (c === 0) classes.push(styles.frameLeft);
    if (c === size - 1) classes.push(styles.frameRight);
  }
  const className = classes.join(' ');

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
      aria-colindex={colIndex}
      data-index={r * size + c}
      data-highlight={isSameNumber ? 'same' : undefined}
      tabIndex={isSelected || isEntry ? 0 : -1}
      className={className}
      onClick={() => selectCell(r, c)}
      // Focus selects, so a player who Tabs onto the entry cell can type immediately —
      // inputDigit is a no-op without a selectedCell. Already-selected focus (the roving
      // effect calling .focus()) is skipped to avoid a redundant store write per move.
      onFocus={() => {
        if (!isSelected) selectCell(r, c);
      }}
    >
      {value !== 0 ? (
        value
      ) : candidates.length ? (
        <div className={styles.candidates} aria-hidden="true">
          {Array.from({ length: maxNum }, (_, i) => {
            const digit = i + 1;
            const present = mask & (1 << i);
            const isMatch = present && digit === candMatch;
            return (
              <span key={i} className={isMatch ? styles.candidateMatch : undefined}>
                {present ? digit : ''}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});

/**
 * A Kakuro black cell — in the clue gutter or inside the interior. Read-only, outside the tab
 * order, never selectable; it shows the sums of the runs it heads, if any: the DOWN sum in the
 * upper-right triangle (above the run it heads) and the ACROSS sum in the lower-left (beside
 * the run it heads), split by a diagonal. A black cell heading no run is plain. Presentational
 * on purpose: the gutter has no store cell behind it, so this takes its clue as a prop.
 */
export function ClueCell({ clue, colIndex }: { clue: BoardClue | null | undefined; colIndex: number }) {
  const hasClue = clue != null && (clue.across != null || clue.down != null);
  return (
    <div
      role="gridcell"
      aria-label={describeClue(clue)}
      aria-readonly
      aria-colindex={colIndex}
      tabIndex={-1}
      className={`${styles.cell} ${styles.block} ${hasClue ? styles.clue : ''}`}
    >
      {clue?.down != null && <span className={styles.clueDown}>{clue.down}</span>}
      {clue?.across != null && <span className={styles.clueAcross}>{clue.across}</span>}
    </div>
  );
}
