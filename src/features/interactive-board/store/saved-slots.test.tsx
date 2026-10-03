// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SudokuPuzzle } from '@/features/engine/sudoku';
import { activateSlot, getActiveSlot, SLOT_KEYS, useBoardStore } from './useBoardStore';
import { readSavedSlot, useBoardSlot, useSavedSlots } from './saved-slots';

/**
 * Two slots, one store: a daily and a free-play game park under different keys and a surface
 * activates its own. These tests do what the player does — start a game on one surface, go
 * to the other, start one there, come back — and read the slots the way the hub does, through
 * localStorage (the boundary), never by reaching into the store for a slot it is not holding.
 */

const SOLUTION = [
  [1, 2, 3, 4],
  [3, 4, 1, 2],
  [2, 1, 4, 3],
  [4, 3, 2, 1],
];
const puzzle = (difficulty: SudokuPuzzle['difficulty'] = 'easy'): SudokuPuzzle => ({
  grid: [
    [0, 0, 3, 4],
    [3, 4, 1, 2],
    [2, 1, 4, 3],
    [4, 3, 2, 1],
  ],
  solution: SOLUTION,
  difficulty,
  gridSize: 4,
});

const persisted = (key: string) => JSON.parse(localStorage.getItem(key) ?? 'null') as { state?: Record<string, unknown> } | null;

beforeEach(() => {
  localStorage.clear();
  activateSlot('play');
  useBoardStore.setState({ status: 'configuring', mode: 'play', dailyDate: null, elapsedTime: 0 });
});

afterEach(() => {
  activateSlot('play');
});

describe('activateSlot', () => {
  it('starts on the free-play slot and persists there', () => {
    expect(getActiveSlot()).toBe('play');
    useBoardStore.getState().startNewGame(puzzle());
    expect(persisted(SLOT_KEYS.play)?.state?.status).toBe('playing');
    expect(localStorage.getItem(SLOT_KEYS.daily)).toBeNull();
  });

  it('parks the free-play game when the daily slot is activated, and brings it back', () => {
    useBoardStore.getState().startNewGame(puzzle('hard'));
    useBoardStore.getState().inputDigit(1); // nothing selected: a no-op, but the game is "in progress"

    activateSlot('daily');

    // The store now holds the (empty) daily slot — a parked free-play game is invisible here…
    expect(getActiveSlot()).toBe('daily');
    expect(useBoardStore.getState().status).toBe('configuring');
    expect(useBoardStore.getState().mode).toBe('daily');
    // …and the switch did not disturb what free play had parked.
    expect(persisted(SLOT_KEYS.play)?.state?.status).toBe('playing');
    expect(persisted(SLOT_KEYS.play)?.state?.difficulty).toBe('hard');
    expect(localStorage.getItem('sudoku-board:void')).toBeNull();

    activateSlot('play');

    expect(useBoardStore.getState().status).toBe('playing');
    expect(useBoardStore.getState().difficulty).toBe('hard');
    expect(useBoardStore.getState().mode).toBe('play');
  });

  it('keeps a daily and a free-play game at the same time', () => {
    useBoardStore.getState().startNewGame(puzzle('medium'));
    activateSlot('daily');
    useBoardStore.getState().startNewGame(puzzle('expert'), 'daily', '2026-10-02');

    expect(persisted(SLOT_KEYS.daily)?.state?.dailyDate).toBe('2026-10-02');
    expect(persisted(SLOT_KEYS.play)?.state?.difficulty).toBe('medium');

    activateSlot('play');
    expect(useBoardStore.getState().difficulty).toBe('medium');
    expect(useBoardStore.getState().dailyDate).toBeNull();
    // The daily is still parked, untouched by the free-play game being live.
    expect(persisted(SLOT_KEYS.daily)?.state?.status).toBe('playing');
  });

  it('is idempotent — re-activating the live slot does not reset the game', () => {
    useBoardStore.getState().startNewGame(puzzle());
    useBoardStore.getState().selectCell(0, 0);
    useBoardStore.getState().inputDigit(1);

    activateSlot('play');

    expect(useBoardStore.getState().status).toBe('playing');
    expect(useBoardStore.getState().grid[0][0]).toBe(1);
  });

  it('drops the undo history of the game that just left', () => {
    useBoardStore.getState().startNewGame(puzzle());
    useBoardStore.getState().selectCell(0, 0);
    useBoardStore.getState().inputDigit(1);
    expect(useBoardStore.temporal.getState().pastStates.length).toBeGreaterThan(0);

    activateSlot('daily');

    expect(useBoardStore.temporal.getState().pastStates).toHaveLength(0);
  });
});

describe('readSavedSlot', () => {
  it('is null for an empty slot and for a game that is not in progress', () => {
    expect(readSavedSlot('play')).toBeNull();
    expect(readSavedSlot('daily')).toBeNull();
    useBoardStore.getState().startNewGame(puzzle());
    useBoardStore.getState().configure(); // back to the menu: nothing to continue
    expect(readSavedSlot('play')).toBeNull();
  });

  it('describes a parked game from storage alone, clock included', () => {
    useBoardStore.getState().startNewGame(puzzle('hard'));
    useBoardStore.setState({ elapsedTime: 42 });
    activateSlot('daily'); // the store no longer holds it

    expect(readSavedSlot('play')).toEqual({
      mode: 'play',
      difficulty: 'hard',
      variant: 'classic',
      gridSize: 4,
      dailyDate: null,
      elapsedTime: 42,
    });
  });

  it('survives garbage in the slot', () => {
    localStorage.setItem(SLOT_KEYS.daily, '{not json');
    expect(readSavedSlot('daily')).toBeNull();
  });
});

describe('useSavedSlots', () => {
  it('reports both slots to the hub', () => {
    useBoardStore.getState().startNewGame(puzzle('medium'));
    activateSlot('daily');
    useBoardStore.getState().startNewGame(puzzle('expert'), 'daily', '2026-10-02');

    const { result } = renderHook(() => useSavedSlots());

    expect(result.current?.play?.difficulty).toBe('medium');
    expect(result.current?.daily?.dailyDate).toBe('2026-10-02');
  });
});

describe('useBoardSlot', () => {
  it('activates the slot during the first render, before any effect', () => {
    useBoardStore.getState().startNewGame(puzzle());
    let statusDuringRender: string | undefined;

    renderHook(() => {
      useBoardSlot('daily');
      statusDuringRender = useBoardStore.getState().status;
    });

    expect(getActiveSlot()).toBe('daily');
    expect(statusDuringRender).toBe('configuring');
    expect(persisted(SLOT_KEYS.play)?.state?.status).toBe('playing');
  });
});

describe('legacy single-slot migration', () => {
  it('moves a pre-slot game into the slot its mode names, once', async () => {
    const legacy = JSON.stringify({ state: { status: 'playing', mode: 'daily', dailyDate: '2026-09-30' }, version: 6 });
    localStorage.setItem('sudoku-board', legacy);
    vi.resetModules();

    await import('./useBoardStore');

    expect(localStorage.getItem('sudoku-board')).toBeNull();
    expect(localStorage.getItem(SLOT_KEYS.daily)).toBe(legacy);
    expect(readSavedSlot('play')).toBeNull();
  });

  it('does not overwrite a game already in the target slot', async () => {
    localStorage.setItem(SLOT_KEYS.play, '{"state":{"status":"playing","mode":"play","difficulty":"hard"},"version":6}');
    localStorage.setItem('sudoku-board', '{"state":{"status":"playing","mode":"play","difficulty":"easy"},"version":6}');
    vi.resetModules();

    await import('./useBoardStore');

    expect(localStorage.getItem('sudoku-board')).toBeNull();
    expect(persisted(SLOT_KEYS.play)?.state?.difficulty).toBe('hard');
  });
});
