// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { useBoardStore } from './useBoardStore';
import { hasBit } from '../board-utils';
import type { SudokuPuzzle } from '@/features/engine/sudoku';

// A valid 4x4 solution with two holes at (0,0) and (0,1).
const SOLUTION = [
  [1, 2, 3, 4],
  [3, 4, 1, 2],
  [2, 1, 4, 3],
  [4, 3, 2, 1],
];
const puzzle = (): SudokuPuzzle => ({
  grid: [
    [0, 0, 3, 4],
    [3, 4, 1, 2],
    [2, 1, 4, 3],
    [4, 3, 2, 1],
  ],
  solution: SOLUTION,
  difficulty: 'easy',
  gridSize: 4,
});

beforeEach(() => {
  // Deterministic starting state for every test (also clears undo history).
  useBoardStore.getState().startNewGame(puzzle());
});

describe('startNewGame', () => {
  it('initializes grid, givens, and status', () => {
    const s = useBoardStore.getState();
    expect(s.status).toBe('playing');
    expect(s.gridSize).toBe(4);
    expect(s.grid[0][0]).toBe(0);
    expect(s.givens[0][0]).toBe(false); // a hole
    expect(s.givens[0][2]).toBe(true);  // a clue
    expect(s.elapsedTime).toBe(0);
  });
});

describe('placing digits', () => {
  it('places a digit in an empty cell and strips it from peers\' candidates', () => {
    const store = useBoardStore.getState();
    // Pencil a candidate 1 into (0,1)...
    store.selectCell(0, 1);
    store.togglePencilMode();
    store.inputDigit(1);
    expect(hasBit(useBoardStore.getState().candidates[0][1], 1)).toBe(true);

    // ...then place 1 in (0,0), a peer of (0,1) -> candidate 1 is stripped.
    store.togglePencilMode();
    store.selectCell(0, 0);
    store.inputDigit(1);
    const s = useBoardStore.getState();
    expect(s.grid[0][0]).toBe(1);
    expect(hasBit(s.candidates[0][1], 1)).toBe(false);
    expect(s.status).toBe('playing'); // (0,1) still empty
  });

  it('never edits a given clue', () => {
    const store = useBoardStore.getState();
    store.selectCell(0, 2); // a given (value 3)
    store.inputDigit(9);
    expect(useBoardStore.getState().grid[0][2]).toBe(3);
  });

  it('counts a mistake only when a wrong value is placed', () => {
    const store = useBoardStore.getState();
    store.selectCell(0, 0); // answer is 1
    store.inputDigit(2);    // wrong
    expect(useBoardStore.getState().mistakes).toBe(1);
    store.inputDigit(1);    // correct (overwrites) — no new mistake
    expect(useBoardStore.getState().mistakes).toBe(1);
  });

  it('detects completion when the grid matches the solution', () => {
    const store = useBoardStore.getState();
    store.selectCell(0, 0);
    store.inputDigit(1);
    store.selectCell(0, 1);
    store.inputDigit(2);
    expect(useBoardStore.getState().status).toBe('solved');
  });
});

describe('digit lockout', () => {
  // Full solution with one hole at (0,3), whose answer is 4 — so all four 1s are
  // already on the board but 4 is not yet complete.
  const lockoutPuzzle = (): SudokuPuzzle => ({
    grid: [
      [1, 2, 3, 0],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 1],
    ],
    solution: SOLUTION,
    difficulty: 'easy',
    gridSize: 4,
  });

  it('blocks placing a digit once all of it is on the board', () => {
    useBoardStore.getState().startNewGame(lockoutPuzzle());
    const store = useBoardStore.getState();
    store.selectCell(0, 3);

    store.inputDigit(1); // all four 1s already placed -> blocked
    expect(useBoardStore.getState().grid[0][3]).toBe(0);

    store.inputDigit(4); // 4 still available -> allowed
    expect(useBoardStore.getState().grid[0][3]).toBe(4);
  });
});

describe('hint', () => {
  it('reveals the correct value for the selected empty cell', () => {
    const store = useBoardStore.getState();
    store.selectCell(0, 0);
    store.hint();
    expect(useBoardStore.getState().grid[0][0]).toBe(SOLUTION[0][0]); // 1
  });

  it('fills the first empty cell when nothing is selected', () => {
    useBoardStore.getState().hint();
    const s = useBoardStore.getState();
    // (0,0) is the first empty cell in row-major order.
    expect(s.grid[0][0]).toBe(SOLUTION[0][0]);
  });

  it('can solve the puzzle when applied to every hole', () => {
    const store = useBoardStore.getState();
    store.hint();
    store.hint();
    expect(useBoardStore.getState().status).toBe('solved');
  });
});

describe('undo/redo (zundo)', () => {
  it('reverts a placement but not the timer', () => {
    const store = useBoardStore.getState();
    store.selectCell(0, 0);
    store.inputDigit(1);
    store.tick();
    store.tick();
    expect(useBoardStore.getState().grid[0][0]).toBe(1);
    expect(useBoardStore.getState().elapsedTime).toBe(2);

    useBoardStore.temporal.getState().undo();

    const s = useBoardStore.getState();
    expect(s.grid[0][0]).toBe(0);   // move reverted
    expect(s.elapsedTime).toBe(2);  // clock NOT rewound
  });
});

describe('timer', () => {
  it('ticks only while playing', () => {
    const store = useBoardStore.getState();
    store.tick();
    expect(useBoardStore.getState().elapsedTime).toBe(1);
    store.pause();
    store.tick();
    expect(useBoardStore.getState().elapsedTime).toBe(1); // paused -> no tick
  });
});
