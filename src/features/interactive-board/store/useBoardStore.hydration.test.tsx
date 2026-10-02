// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { KAKURO_FIXTURE_7X7_CHAINS } from '@/features/engine/kakuro/kakuro-fixtures';
import { generateKillerSudoku } from '@/features/engine/killer/killer-sudoku';
import { SKYSCRAPERS_FIXTURE_5X5 } from '@/features/engine/skyscrapers/skyscrapers-fixtures';
import { useBoardStore } from './useBoardStore';

/**
 * The derived fields (`peers`, `cellToCage`, `blocked`, `cellToRuns`, `clues`) are NOT persisted;
 * they are rebuilt when a saved game is read back. These tests do what the browser does on a
 * reload: start a game, take what `persist` wrote to localStorage, reset the store, and
 * rehydrate from storage alone — then read the derived fields exactly as a rendered cell would.
 *
 * Why this file exists (pre-merge log, 2026-10-01, "a reload is a test case"): the rebuild
 * used to happen by mutating state after hydration, which no subscriber sees; every other
 * store test starts games through `startNewGame` and could never notice.
 */

const STORAGE_KEY = 'sudoku-board';

/**
 * Clear the in-memory store so nothing survives except what storage holds. `persist` writes on
 * every `setState`, so the wipe itself overwrites the saved game — callers snapshot storage
 * first and put it back (`snapshotAndWipe`), which is what a reload does for free.
 */
function wipeStore() {
  useBoardStore.setState({
    status: 'configuring',
    runs: [],
    cages: [],
    peers: [],
    cellToCage: [],
    blocked: [],
    cellToRuns: [],
    clues: [],
    edgeClues: null,
    doneClues: [],
  });
}

function snapshotAndWipe(): string {
  const saved = localStorage.getItem(STORAGE_KEY);
  expect(saved).toBeTruthy();
  wipeStore();
  localStorage.setItem(STORAGE_KEY, saved as string);
  return saved as string;
}

beforeEach(() => {
  localStorage.clear();
});

describe('rehydrating a saved game rebuilds every derived field', () => {
  it('Kakuro: blocked, cellToRuns, clues and run-mate peers come back', async () => {
    useBoardStore.getState().startNewGame(KAKURO_FIXTURE_7X7_CHAINS);
    const saved = snapshotAndWipe();
    expect(JSON.parse(saved).state.runs).toHaveLength(20);
    expect(JSON.parse(saved).state.blocked).toBeUndefined(); // derived, never persisted
    expect(useBoardStore.getState().blocked).toEqual([]);

    await useBoardStore.persist.rehydrate();

    const s = useBoardStore.getState();
    expect(s.variant).toBe('kakuro');
    expect(s.runs).toHaveLength(20);
    expect(s.blocked[0][0]).toBe(true); // the fixture's top-left corner is black
    expect(s.blocked.flat().filter(Boolean)).toHaveLength(17);
    expect(s.clues.filter(Boolean).length).toBeGreaterThan(0);
    expect(s.cellToRuns).toHaveLength(7 * 7 * 2);
    expect(s.peers).toHaveLength(49);
    expect(s.peers[2].length).toBeGreaterThan(0); // (0,2) is white and has run-mates
    expect(s.peers[0]).toEqual([]); // a black cell has none
  });

  it('Killer: cellToCage comes back (it was one interaction late before the merge fix)', async () => {
    useBoardStore.getState().startNewGame(generateKillerSudoku('easy', { gridSize: 4 }));
    snapshotAndWipe();
    expect(useBoardStore.getState().cellToCage).toEqual([]);

    await useBoardStore.persist.rehydrate();

    const s = useBoardStore.getState();
    expect(s.variant).toBe('killer');
    expect(s.cellToCage).toHaveLength(16);
    expect(s.cellToCage.every((id) => id >= 0)).toBe(true);
    expect(s.peers).toHaveLength(16);
  });
});

describe('rehydrating a saved Skyscrapers game', () => {
  it('brings back the edge clues, the done marks and row/column peers', async () => {
    useBoardStore.getState().startNewGame(SKYSCRAPERS_FIXTURE_5X5);
    useBoardStore.getState().toggleClueDone('top', 2);
    const saved = snapshotAndWipe();
    expect(JSON.parse(saved).state.edgeClues).toEqual(SKYSCRAPERS_FIXTURE_5X5.clues); // persisted — it IS the puzzle
    expect(JSON.parse(saved).state.doneClues[2]).toBe(true);
    expect(useBoardStore.getState().edgeClues).toBeNull();

    await useBoardStore.persist.rehydrate();

    const s = useBoardStore.getState();
    expect(s.variant).toBe('skyscrapers');
    expect(s.edgeClues).toEqual(SKYSCRAPERS_FIXTURE_5X5.clues);
    expect(s.doneClues[2]).toBe(true);
    expect(s.peers).toHaveLength(25);
    expect([...s.peers[0]].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 10, 15, 20]);
    expect(s.blocked).toEqual([]);
  });
});

describe('undo/redo write through to storage (persist outside temporal)', () => {
  it('an undo is in localStorage immediately, not on the next tick', () => {
    useBoardStore.getState().startNewGame(generateKillerSudoku('easy', { gridSize: 4 }));
    const s = useBoardStore.getState();
    const target = s.givens.flat().findIndex((given) => !given);
    const r = Math.floor(target / 4);
    const c = target % 4;
    s.selectCell(r, c);
    s.inputDigit(s.solution[r][c]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).state.grid[r][c]).toBe(s.solution[r][c]);

    useBoardStore.temporal.getState().undo();

    // zundo's undo/redo write through the raw `set` the middleware was handed. With temporal
    // OUTSIDE persist that set bypassed persist, so storage kept the pre-undo grid until the
    // timer's next tick — and a reload inside that second resurrected the undone move.
    expect(useBoardStore.getState().grid[r][c]).toBe(0);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).state.grid[r][c]).toBe(0);
  });

  it('hydration records no undo history and completes (hasHydrated flips)', async () => {
    useBoardStore.getState().startNewGame(generateKillerSudoku('easy', { gridSize: 4 }));
    snapshotAndWipe();
    useBoardStore.temporal.getState().clear();
    await useBoardStore.persist.rehydrate();
    expect(useBoardStore.persist.hasHydrated()).toBe(true);
    expect(useBoardStore.temporal.getState().pastStates).toHaveLength(0);
  });
});
