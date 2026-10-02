// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { useBoardStore } from './useBoardStore';
import { hasBit } from '../board-utils';
import type { SudokuPuzzle } from '@/features/engine/sudoku';
import { KAKURO_FIXTURE_7X7_CHAINS, parseKakuroFixture } from '@/features/engine/kakuro/kakuro-fixtures';
import { parseSkyscrapersFixture } from '@/features/engine/skyscrapers/skyscrapers-fixtures';

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

describe('stale `peers` self-heals instead of crashing (rehydration race)', () => {
  // Simulates the narrow window where `config`/`status` have restored from persistence but
  // the separate `onRehydrateStorage` callback hasn't yet rebuilt `peers` — bypassing the
  // store's own actions to force it into that state directly.
  it('inputDigit still strips peers\' candidates when peers was stale/empty', () => {
    const store = useBoardStore.getState();
    store.selectCell(0, 1);
    store.togglePencilMode();
    store.inputDigit(1); // candidate 1 pencilled into (0,1)
    store.togglePencilMode();

    useBoardStore.setState({ peers: [] }); // simulate the race
    store.selectCell(0, 0);
    expect(() => store.inputDigit(1)).not.toThrow();

    const s = useBoardStore.getState();
    expect(s.grid[0][0]).toBe(1);
    expect(hasBit(s.candidates[0][1], 1)).toBe(false); // still stripped correctly
  });

  it('hint still strips peers\' candidates when peers was stale/empty', () => {
    const store = useBoardStore.getState();
    store.selectCell(0, 1);
    store.togglePencilMode();
    store.inputDigit(1); // candidate 1 pencilled into (0,1) — (0,0)'s solved value
    store.togglePencilMode();

    useBoardStore.setState({ peers: [] }); // simulate the race
    store.selectCell(0, 0);
    expect(() => store.hint()).not.toThrow();

    const s = useBoardStore.getState();
    expect(s.grid[0][0]).toBe(SOLUTION[0][0]); // 1
    expect(hasBit(s.candidates[0][1], 1)).toBe(false); // stripped even though peers was stale
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

  it('freezes a completed grid — undo cannot un-solve it', () => {
    const store = useBoardStore.getState();
    // Solve the two remaining holes: (0,0)=1, (0,1)=2.
    store.selectCell(0, 0);
    store.inputDigit(1);
    store.selectCell(0, 1);
    store.inputDigit(2);
    expect(useBoardStore.getState().status).toBe('solved');

    // The undo/redo history is cleared on completion, so an undo (button OR Cmd/Ctrl+Z) no-ops.
    expect(useBoardStore.temporal.getState().pastStates).toHaveLength(0);
    useBoardStore.temporal.getState().undo();

    const s = useBoardStore.getState();
    expect(s.grid[0][0]).toBe(1); // still solved — not reverted
    expect(s.grid[0][1]).toBe(2);
    expect(s.status).toBe('solved');
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

describe('Kakuro', () => {
  // 3×3, black in two opposite corners:
  //   # 1 3        across sums: 4 / 7 / 8
  //   1 2 4        down sums:   4 / 8 / 7
  //   3 5 #
  const kakuro = () => parseKakuroFixture(['#13', '124', '35#'], 'easy');

  beforeEach(() => {
    useBoardStore.getState().startNewGame(kakuro());
  });

  it('starts with a boxless 1–9 config, black cells as uneditable givens, and derived clues', () => {
    const s = useBoardStore.getState();
    expect(s.variant).toBe('kakuro');
    expect(s.config).toMatchObject({ size: 3, hasBoxes: false, maxNum: 9 });
    expect(s.grid.flat().every((v) => v === 0)).toBe(true);
    expect(s.blocked).toEqual([
      [true, false, false],
      [false, false, false],
      [false, false, true],
    ]);
    expect(s.givens).toEqual(s.blocked); // the corners cannot be edited; nothing else is a given
    expect(s.runs).toHaveLength(6);
    expect(s.clues[1 * 4 + 1]).toEqual({ across: 4, down: 4 });
  });

  it('uses run-mates as peers, not row/column/box', () => {
    const { peers } = useBoardStore.getState();
    // Centre (1,1) = index 4: across [3,4,5] + down [1,4,7]; the corners are not peers of anything.
    expect([...peers[4]].sort((a, b) => a - b)).toEqual([1, 3, 5, 7]);
    expect(peers[0]).toEqual([]);
  });

  it('refuses a digit on a black cell', () => {
    const store = useBoardStore.getState();
    store.selectCell(0, 0);
    store.inputDigit(5);
    expect(useBoardStore.getState().grid[0][0]).toBe(0);
    expect(useBoardStore.getState().mistakes).toBe(0);
  });

  it('strips a placed digit from the pencil marks of both runs, and nothing else', () => {
    const store = useBoardStore.getState();
    store.togglePencilMode();
    for (const [r, c] of [[0, 1], [1, 0], [1, 2], [2, 1], [0, 2]] as const) {
      store.selectCell(r, c);
      store.inputDigit(2);
    }
    store.togglePencilMode();
    store.selectCell(1, 1);
    store.inputDigit(2); // the centre: across run (1,0)(1,1)(1,2), down run (0,1)(1,1)(2,1)

    const { candidates } = useBoardStore.getState();
    expect(hasBit(candidates[1][0], 2)).toBe(false);
    expect(hasBit(candidates[1][2], 2)).toBe(false);
    expect(hasBit(candidates[0][1], 2)).toBe(false);
    expect(hasBit(candidates[2][1], 2)).toBe(false);
    expect(hasBit(candidates[0][2], 2)).toBe(true); // shares neither run with the centre
  });

  it('never locks a digit out — there is no per-digit count without houses', () => {
    useBoardStore.getState().startNewGame(KAKURO_FIXTURE_7X7_CHAINS);
    const store = useBoardStore.getState();
    // Sudoku would refuse an 8th instance of a digit on a 7×7 (`placed >= size`). Put a 1 in the
    // first eight white cells — right or wrong — and every one must land.
    const whites: [number, number][] = [];
    useBoardStore.getState().blocked.forEach((row, r) => row.forEach((b, c) => { if (!b) whites.push([r, c]); }));
    for (const [r, c] of whites.slice(0, 8)) {
      store.selectCell(r, c);
      store.inputDigit(1);
    }
    const { grid } = useBoardStore.getState();
    expect(whites.slice(0, 8).every(([r, c]) => grid[r][c] === 1)).toBe(true);
  });

  it('hints a cell the solver deduces rather than the first empty cell', () => {
    // From the empty 7×7, propagation forces exactly two cells — (3,5) = 4 and (3,6) = 2, the
    // 6-in-two run {2,4} crossed by its down runs — and nothing in row 0. A plain reveal would
    // fill the first empty cell, (0,2); the solver-driven hint fills a forced one.
    useBoardStore.getState().startNewGame(KAKURO_FIXTURE_7X7_CHAINS);
    useBoardStore.getState().hint();
    const s = useBoardStore.getState();
    expect(s.grid[3][5]).toBe(4);
    expect(s.grid[0][2]).toBe(0);
  });

  it('hints the selected cell when the solver forces it', () => {
    useBoardStore.getState().startNewGame(KAKURO_FIXTURE_7X7_CHAINS);
    const store = useBoardStore.getState();
    store.selectCell(3, 6);
    store.hint();
    const s = useBoardStore.getState();
    expect(s.grid[3][6]).toBe(2);
    expect(s.grid[3][5]).toBe(0);
  });

  it('skips a forced cell that disagrees with the answer but keeps the rest', () => {
    // On the 7×7, (3,5)=4 and (3,6)=2 are the only cells forced from empty, via the 6-in-two run
    // {2,4}. Planting a 3 in (2,5) (above (3,5)) leaves the board consistent but changes what the
    // 6-in-two's down runs force: propagation now forces (3,5) to a digit that is NOT the answer.
    // The hint must not place that, nor fall back to a blind reveal while another deduced cell
    // is still correct — it should find the next forced cell that agrees with the solution.
    useBoardStore.getState().startNewGame(KAKURO_FIXTURE_7X7_CHAINS);
    const store = useBoardStore.getState();
    const beforeHint = useBoardStore.getState().grid.map((row) => [...row]);
    store.selectCell(2, 5);
    store.inputDigit(3); // wrong ((2,5) is 8) but not immediately contradictory
    store.hint();
    const s = useBoardStore.getState();
    // Exactly one new cell was filled, and whatever it is, it holds the solution's digit.
    const changed: [number, number][] = [];
    s.grid.forEach((row, r) => row.forEach((v, c) => { if (v !== beforeHint[r][c] && !(r === 2 && c === 5)) changed.push([r, c]); }));
    expect(changed).toHaveLength(1);
    const [[r, c]] = changed;
    expect(s.grid[r][c]).toBe(KAKURO_FIXTURE_7X7_CHAINS.solution[r][c]);
  });

  it('falls back to the answer when the board holds a mistake the solver cannot see past', () => {
    // (0,1) = 9 contradicts the top across run (4-in-two): propagation reports a contradiction,
    // so the hint reveals the first empty cell from the solution instead of trusting a deduction.
    const store = useBoardStore.getState();
    store.selectCell(0, 1);
    store.inputDigit(9);
    store.selectCell(1, 1);
    store.hint();
    expect(useBoardStore.getState().grid[1][1]).toBe(2);
  });

  it('is solved when every white cell matches, with black cells left at 0', () => {
    const store = useBoardStore.getState();
    for (let i = 0; i < 7; i++) store.hint();
    expect(useBoardStore.getState().status).toBe('solved');
  });
});

describe('Skyscrapers', () => {
  // 4×4 with every clue kept except the right side.
  const skyscrapers = () =>
    parseSkyscrapersFixture(['1234', '2143', '3412', '4321'], { top: 'xxxx', bottom: 'xxxx', left: 'xxxx', right: '....' });

  beforeEach(() => {
    useBoardStore.getState().startNewGame(skyscrapers());
  });

  it('starts with a boxless 1..N config, no givens, the edge clues, and no clue marked done', () => {
    const s = useBoardStore.getState();
    expect(s.variant).toBe('skyscrapers');
    expect(s.config).toMatchObject({ size: 4, hasBoxes: false, maxNum: 4 });
    expect(s.grid.flat().every((v) => v === 0)).toBe(true);
    expect(s.givens.flat().every((g) => g === false)).toBe(true);
    expect(s.edgeClues).toEqual({ top: [4, 2, 2, 1], bottom: [1, 2, 2, 4], left: [4, 2, 2, 1], right: [0, 0, 0, 0] });
    expect(s.doneClues).toEqual(new Array(16).fill(false));
    expect(s.runs).toEqual([]);
    expect(s.blocked).toEqual([]);
  });

  it('uses row and column peers only — no box, even at a size that has boxes for Sudoku', () => {
    const { peers } = useBoardStore.getState();
    // (0,0) = index 0: its row [1,2,3] and its column [4,8,12]; a 2×2 box would add 5.
    expect([...peers[0]].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 8, 12]);
  });

  it('locks a height out once all N instances are placed (Latin square)', () => {
    const store = useBoardStore.getState();
    for (let r = 0; r < 4; r++) {
      store.selectCell(r, (4 - r) % 4); // a diagonal of 1s: (0,0) (1,3) (2,2) (3,1)
      store.inputDigit(1);
    }
    expect(useBoardStore.getState().grid.flat().filter((v) => v === 1)).toHaveLength(4);
    store.selectCell(0, 1);
    store.inputDigit(1);
    expect(useBoardStore.getState().grid[0][1]).toBe(0);
  });

  it('toggles a clue done as an undo-able move, and ignores a blank clue slot out of range', () => {
    const store = useBoardStore.getState();
    store.toggleClueDone('left', 2);
    expect(useBoardStore.getState().doneClues[2 * 4 + 2]).toBe(true);
    store.toggleClueDone('left', 2);
    expect(useBoardStore.getState().doneClues[2 * 4 + 2]).toBe(false);

    store.toggleClueDone('top', 0);
    useBoardStore.temporal.getState().undo();
    expect(useBoardStore.getState().doneClues[0]).toBe(false);
    useBoardStore.temporal.getState().redo();
    expect(useBoardStore.getState().doneClues[0]).toBe(true);

    // An index past the side's end must not wrap into the next side's flags.
    store.toggleClueDone('top', 5);
    expect(useBoardStore.getState().doneClues[5]).toBe(false);
    store.toggleClueDone('right', 9);
    expect(useBoardStore.getState().doneClues).toHaveLength(16);
    expect(useBoardStore.getState().doneClues.filter(Boolean)).toHaveLength(1);
  });

  it('keeps its own copy of the clues, not the puzzle\'s arrays', () => {
    const source = skyscrapers();
    useBoardStore.getState().startNewGame(source);
    expect(useBoardStore.getState().edgeClues).toEqual(source.clues);
    expect(useBoardStore.getState().edgeClues).not.toBe(source.clues);
    expect(useBoardStore.getState().edgeClues?.top).not.toBe(source.clues.top);
  });

  it('does nothing on a non-Skyscrapers game', () => {
    useBoardStore.getState().startNewGame(puzzle());
    useBoardStore.getState().toggleClueDone('top', 0);
    expect(useBoardStore.getState().doneClues).toEqual([]);
    expect(useBoardStore.getState().edgeClues).toBeNull();
  });

  it('hints the logical solver\'s next step and names its technique (E2)', () => {
    // Top clue 4 on column 0: the heights climb 1..4, so the first step is clueN at (0,0).
    useBoardStore.getState().hint();
    const s = useBoardStore.getState();
    expect(s.grid[0][0]).toBe(1);
    expect(s.lastHint?.technique).toBe('clueN');
    expect(s.lastHint?.explanation).toMatch(/every tower is visible/);
  });

  it('hints the selected cell by name when a rule can place it, even if the ladder would place elsewhere first', () => {
    const store = useBoardStore.getState();
    store.selectCell(2, 0); // the top clue 4 climbs 1..4, so (2,0) is 3 — placed directly, not via (0,0)
    store.hint();
    const s = useBoardStore.getState();
    expect(s.grid[2][0]).toBe(3);
    expect(s.grid[0][0]).toBe(0);
    expect(s.lastHint?.technique).toBe('clueN');
  });

  it('falls back to the answer when the board holds a mistake the solver cannot see past', () => {
    const store = useBoardStore.getState();
    store.selectCell(0, 0);
    store.inputDigit(4); // under a top clue of 4, impossible — propagation reports a contradiction
    store.selectCell(3, 3);
    store.hint();
    const s = useBoardStore.getState();
    expect(s.grid[3][3]).toBe(1); // the selected empty cell, revealed from the solution
    expect(s.lastHint?.explanation).toMatch(/^Revealed/);
  });
});
