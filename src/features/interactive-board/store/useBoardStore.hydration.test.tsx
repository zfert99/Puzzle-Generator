// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { KAKURO_FIXTURE_7X7 } from '@/features/engine/kakuro/kakuro-fixtures';
import { generateKillerSudoku } from '@/features/engine/killer/killer-sudoku';
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
    useBoardStore.getState().startNewGame(KAKURO_FIXTURE_7X7);
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
