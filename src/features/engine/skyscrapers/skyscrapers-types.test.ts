import { describe, expect, it } from 'vitest';
import {
  buildDisplayCells,
  clueAt,
  clueFlatIndex,
  clueStatus,
  deriveClues,
  lineFor,
  presentClueCount,
  skyscrapersGridConfig,
  skyscrapersTracks,
  validateSkyscrapers,
  visibleCount,
  type SkyscrapersPuzzle,
} from './skyscrapers-types';

/** A 4×4 Latin square used throughout; its clues are derived, never typed. */
const SQUARE = [
  [1, 2, 3, 4],
  [2, 1, 4, 3],
  [3, 4, 1, 2],
  [4, 3, 2, 1],
];

function puzzleOf(solution: number[][], overrides: Partial<SkyscrapersPuzzle> = {}): SkyscrapersPuzzle {
  const size = solution.length as SkyscrapersPuzzle['gridSize'];
  return {
    variant: 'skyscrapers',
    gridSize: size,
    grid: solution.map((row) => row.map(() => 0)),
    solution,
    clues: deriveClues(solution),
    difficulty: 'unrated',
    ...overrides,
  };
}

describe('skyscrapersGridConfig', () => {
  it('is boxless at every size, with heights 1..N', () => {
    expect(skyscrapersGridConfig(6)).toEqual({ size: 6, hasBoxes: false, boxWidth: 6, boxHeight: 1, totalCells: 36, maxNum: 6 });
    expect(skyscrapersGridConfig(5).maxNum).toBe(5);
  });
});

describe('skyscrapersTracks / buildDisplayCells', () => {
  it('adds a gutter cell on each side of the interior', () => {
    expect(skyscrapersTracks(5)).toBe(7);
    const cells = buildDisplayCells(5);
    expect(cells).toHaveLength(7);
    expect(cells.every((row) => row.length === 7)).toBe(true);
  });

  it('classifies corners, gutter strips and play cells by display position', () => {
    const cells = buildDisplayCells(4);
    const flat = cells.flat();

    expect(flat.filter((cell) => cell.kind === 'corner')).toHaveLength(4);
    expect(flat.filter((cell) => cell.kind === 'gutter')).toHaveLength(16);
    expect(flat.filter((cell) => cell.kind === 'play')).toHaveLength(16);
    expect(cells[0][1]).toEqual({ kind: 'gutter', side: 'top', index: 0 });
    expect(cells[5][4]).toEqual({ kind: 'gutter', side: 'bottom', index: 3 });
    expect(cells[2][0]).toEqual({ kind: 'gutter', side: 'left', index: 1 });
    expect(cells[3][5]).toEqual({ kind: 'gutter', side: 'right', index: 2 });
    expect(cells[1][1]).toEqual({ kind: 'play', row: 0, col: 0 });
    expect(cells[4][4]).toEqual({ kind: 'play', row: 3, col: 3 });
  });

  it('indexes every gutter strip 0..N-1 along its own side', () => {
    const cells = buildDisplayCells(3);
    const indices = (side: string) =>
      cells.flat().flatMap((cell) => (cell.kind === 'gutter' && cell.side === side ? [cell.index] : []));

    for (const side of ['top', 'bottom', 'left', 'right']) expect(indices(side)).toEqual([0, 1, 2]);
  });
});

describe('visibleCount', () => {
  it('counts strict running maxima from the clue end', () => {
    expect(visibleCount([1, 2, 3, 4])).toBe(4);
    expect(visibleCount([4, 3, 2, 1])).toBe(1);
    expect(visibleCount([2, 1, 4, 3])).toBe(2);
    expect(visibleCount([3, 1, 4, 2])).toBe(2);
  });

  it('ignores empty cells, so it is also the "visible so far" count of a partial line', () => {
    expect(visibleCount([2, 0, 0, 0])).toBe(1);
    expect(visibleCount([0, 0, 0, 0])).toBe(0);
    expect(visibleCount([2, 0, 4, 0])).toBe(2);
  });

  it('agrees with a brute-force definition on random lines', () => {
    const brute = (line: number[]) =>
      line.filter((height, i) => height > 0 && line.slice(0, i).every((earlier) => earlier < height)).length;
    let seed = 7;
    const next = () => (seed = (seed * 48271) % 2147483647);
    for (let trial = 0; trial < 300; trial++) {
      const line = Array.from({ length: 1 + (next() % 9) }, () => next() % 10);
      expect(visibleCount(line)).toBe(brute(line));
    }
  });
});

describe('lineFor', () => {
  it('reads each side inward, first element nearest the clue', () => {
    expect(lineFor(SQUARE, 'left', 1)).toEqual([2, 1, 4, 3]);
    expect(lineFor(SQUARE, 'right', 1)).toEqual([3, 4, 1, 2]);
    expect(lineFor(SQUARE, 'top', 2)).toEqual([3, 4, 1, 2]);
    expect(lineFor(SQUARE, 'bottom', 2)).toEqual([2, 1, 4, 3]);
  });
});

describe('deriveClues', () => {
  it('produces all 4N clues of a solved square', () => {
    expect(deriveClues(SQUARE)).toEqual({
      top: [4, 2, 2, 1],
      bottom: [1, 2, 2, 4],
      left: [4, 2, 2, 1],
      right: [1, 2, 2, 4],
    });
  });

  it('pairs top/bottom by column and left/right by row, so a derived puzzle validates', () => {
    expect(validateSkyscrapers(puzzleOf(SQUARE))).toEqual([]);
  });
});

describe('clueAt / presentClueCount', () => {
  it('reads a clue, treats blank and absent alike, and counts the present ones', () => {
    const clues = deriveClues(SQUARE);
    clues.top[1] = 0;
    clues.right = [0, 2];

    expect(clueAt(clues, 'top', 0)).toBe(4);
    expect(clueAt(clues, 'top', 1)).toBe(0);
    expect(clueAt(clues, 'right', 3)).toBe(0);
    expect(clueAt({ ...clues, left: undefined as unknown as number[] }, 'left', 0)).toBe(0);
    expect(presentClueCount(clues)).toBe(4 + 4 + 3 + 1);
  });
});

describe('validateSkyscrapers', () => {
  it('passes a puzzle with blank clues', () => {
    const clues = deriveClues(SQUARE);
    clues.top[1] = 0;
    clues.right = [0, 0, 0, 0];
    expect(validateSkyscrapers(puzzleOf(SQUARE, { clues }))).toEqual([]);
  });

  it('reports a clue that disagrees with the solution, and one outside 1..N', () => {
    const clues = deriveClues(SQUARE);
    clues.left[0] = 3;
    clues.bottom[3] = 5;
    expect(validateSkyscrapers(puzzleOf(SQUARE, { clues }))).toEqual([
      'bottom clue 3: 5 is outside 1..4',
      'left clue 0: 3 but the solution shows 4',
    ]);
  });

  it('reports a clue array of the wrong length', () => {
    const clues = deriveClues(SQUARE);
    clues.top = [4, 2, 2];
    expect(validateSkyscrapers(puzzleOf(SQUARE, { clues }))).toEqual(['top clues: 3 entries, expected 4']);
  });

  it('reports a non-Latin solution and stops there', () => {
    const broken = SQUARE.map((row) => [...row]);
    broken[0][0] = 2;
    expect(validateSkyscrapers(puzzleOf(broken))).toEqual(['solution is not a Latin square of 1..N']);
  });

  it('reports a given that disagrees with the solution, and accepts one that agrees', () => {
    const wrong = puzzleOf(SQUARE);
    wrong.grid[2][1] = 1;
    expect(validateSkyscrapers(wrong)).toEqual(['grid cell (2, 1) holds 1, solution has 4']);

    const right = puzzleOf(SQUARE);
    right.grid[2][1] = 4;
    expect(validateSkyscrapers(right)).toEqual([]);
  });

  it('reports a size mismatch', () => {
    expect(validateSkyscrapers(puzzleOf(SQUARE, { gridSize: 5 }))).toContain('solution has 4 rows, expected 5');
  });
});

describe('clueStatus', () => {
  it('is open on an empty or unjudgeable line, and for a blank clue', () => {
    expect(clueStatus([0, 0, 0, 0], 2)).toBe('open');
    expect(clueStatus([2, 0, 0, 0], 2)).toBe('open');
    expect(clueStatus([0, 3, 4, 1], 2)).toBe('open'); // nothing filled from the clue end
    expect(clueStatus([1, 2, 3, 4], 0)).toBe('open');
  });

  it('is satisfied only when the line is complete and the count matches', () => {
    expect(clueStatus([1, 2, 3, 4], 4)).toBe('satisfied');
    expect(clueStatus([2, 1, 4, 3], 2)).toBe('satisfied');
    expect(clueStatus([1, 2, 3, 4], 3)).toBe('violated');
  });

  it('flags a violation as soon as the filled prefix proves it', () => {
    expect(clueStatus([1, 2, 0, 0], 1)).toBe('violated'); // already two visible
    expect(clueStatus([4, 0, 0, 0], 2)).toBe('violated'); // tallest first, nothing more can show
    expect(clueStatus([2, 3, 0, 0], 2)).toBe('violated'); // count reached, 4 still to come
    expect(clueStatus([3, 1, 2, 0], 3)).toBe('violated'); // one cell left cannot add two
    expect(clueStatus([2, 0, 0, 0], 3)).toBe('open'); // 3 and 4 may still show
    expect(clueStatus([3, 1, 0, 0], 2)).toBe('open'); // 4 will show, making two
  });
});

describe('clueFlatIndex', () => {
  it('packs the four sides in order', () => {
    expect(clueFlatIndex('top', 0, 5)).toBe(0);
    expect(clueFlatIndex('bottom', 4, 5)).toBe(9);
    expect(clueFlatIndex('left', 2, 5)).toBe(12);
    expect(clueFlatIndex('right', 0, 5)).toBe(15);
  });
});
