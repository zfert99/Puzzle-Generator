import { describe, expect, it } from 'vitest';
import { deriveRuns, validateKakuroLayout, whiteMaskOf } from './kakuro-layout';

/** `.` = white, `#` = black. */
function mask(rows: string[]): boolean[][] {
  return rows.map((row) => [...row].map((char) => char === '.'));
}

describe('deriveRuns', () => {
  it('turns each maximal strip of 2+ white cells into a run, across first then down', () => {
    const solution = [
      [0, 1, 3],
      [1, 2, 4],
      [3, 5, 0],
    ];

    expect(deriveRuns(solution)).toEqual([
      { id: 0, dir: 'across', cells: [1, 2], sum: 4 },
      { id: 1, dir: 'across', cells: [3, 4, 5], sum: 7 },
      { id: 2, dir: 'across', cells: [6, 7], sum: 8 },
      { id: 3, dir: 'down', cells: [3, 6], sum: 4 },
      { id: 4, dir: 'down', cells: [1, 4, 7], sum: 8 },
      { id: 5, dir: 'down', cells: [2, 5], sum: 7 },
    ]);
  });

  it('agrees with an independent per-cell scan on random grids', () => {
    // The independent scan asks a different question of the same grid: for one white cell, walk
    // outward in both directions until a black cell or the edge. Every cell of a strip must
    // report the same extent, and that extent must be one of the derived runs.
    for (let trial = 0; trial < 200; trial++) {
      const size = 3 + Math.floor(Math.random() * 8);
      const solution = Array.from({ length: size }, () =>
        Array.from({ length: size }, () => (Math.random() < 0.3 ? 0 : 1 + Math.floor(Math.random() * 9)))
      );
      const runs = deriveRuns(solution);
      const derived = new Set(runs.map((run) => `${run.dir}:${run.cells.join(',')}:${run.sum}`));
      const expected = new Set<string>();

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (solution[r][c] === 0) continue;

          let left = c;
          while (left > 0 && solution[r][left - 1] !== 0) left--;
          let right = c;
          while (right < size - 1 && solution[r][right + 1] !== 0) right++;
          if (right > left) {
            const cells: number[] = [];
            let sum = 0;
            for (let i = left; i <= right; i++) {
              cells.push(r * size + i);
              sum += solution[r][i];
            }
            expected.add(`across:${cells.join(',')}:${sum}`);
          }

          let top = r;
          while (top > 0 && solution[top - 1][c] !== 0) top--;
          let bottom = r;
          while (bottom < size - 1 && solution[bottom + 1][c] !== 0) bottom++;
          if (bottom > top) {
            const cells: number[] = [];
            let sum = 0;
            for (let i = top; i <= bottom; i++) {
              cells.push(i * size + c);
              sum += solution[i][c];
            }
            expected.add(`down:${cells.join(',')}:${sum}`);
          }
        }
      }

      expect(derived).toEqual(expected);
      expect(runs.map((run) => run.id)).toEqual(runs.map((_, index) => index));
    }
  });
});

describe('whiteMaskOf', () => {
  it('treats 0 as black and any digit as white', () => {
    expect(whiteMaskOf([[0, 5], [9, 0]])).toEqual([[false, true], [true, false]]);
  });
});

describe('validateKakuroLayout', () => {
  it('accepts a legal layout', () => {
    expect(validateKakuroLayout(mask(['#..', '...', '..#']))).toEqual([]);
  });

  it('rejects a non-square layout', () => {
    expect(validateKakuroLayout(mask(['..', '...']))).toEqual(['layout is not a non-empty square']);
  });

  it('reports a white cell with no run in one direction', () => {
    // The top-middle cell has whites left and right but black below: an across run, no down run.
    const errors = validateKakuroLayout(mask(['...', '.#.', '...']));

    expect(errors).toContain('cell 1: has no down run (a lone white cell)');
  });

  it('reports a white region split in two', () => {
    const errors = validateKakuroLayout(mask(['..#..', '..#..', '#####', '..#..', '..#..']));

    expect(errors).toContain('white cells are not one connected region');
  });

  it('reports a layout that is not 180° symmetric', () => {
    expect(validateKakuroLayout(mask(['#..', '...', '...']))).toContain(
      'layout is not 180° rotationally symmetric'
    );
  });

  it('reports a run longer than nine cells', () => {
    const errors = validateKakuroLayout(mask(Array.from({ length: 10 }, () => '..........')));

    expect(errors).toContain('across run at cell 0: length 10 exceeds 9');
    expect(errors).toContain('down run at cell 0: length 10 exceeds 9');
  });

  it('reports a critical all-white rectangle in either orientation', () => {
    const wide = validateKakuroLayout(mask(['#########', '.........', '.........', '#########', '#########', '#########', '.........', '.........', '#########']));
    const tall = validateKakuroLayout(mask(Array.from({ length: 9 }, () => '#..###..#')));

    expect(wide).toContain('contains an all-white 2×9 rectangle (never uniquely solvable)');
    expect(tall).toContain('contains an all-white 2×9 rectangle (never uniquely solvable)');
  });

  it('allows a 5×5 block once an interior black cell breaks it up', () => {
    // 7×7 with a black ring and a 5×5 white middle: critical. Blacking out the centre cell
    // leaves no contiguous 5×5 (the check is on real rectangles, not bounding boxes).
    const ring = ['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#######'];
    const broken = [...ring];
    broken[3] = '#..#..#';
    const critical = 'contains an all-white 5×5 rectangle (never uniquely solvable)';

    expect(validateKakuroLayout(mask(ring))).toContain(critical);
    expect(validateKakuroLayout(mask(broken))).not.toContain(critical);
  });

  it('reports a layout over the white-cell ceiling for its size', () => {
    // 6×6 allows at most 24 whites; this has 32.
    const errors = validateKakuroLayout(mask(['#....#', '......', '......', '......', '......', '#....#']));

    expect(errors).toContain('32 white cells exceeds the 6×6 ceiling of 24');
  });

  it('reports a layout under the interior-hint floor for its size', () => {
    // 9×9 needs at least 5 interior HINT cells (black cells heading a run); an all-white grid has none.
    const errors = validateKakuroLayout(mask(Array.from({ length: 9 }, () => '.........')));

    expect(errors).toContain('0 interior hint cells is below the 9×9 floor of 5');
  });

  it('does not count a black cell that heads no run as a hint', () => {
    // Twelve interior black cells, but only four head a run: the top-left 2×3 block's right
    // column and bottom row face white cells; the bottom-right block faces only the edge and
    // itself. Counting blacks (12 ≥ 5) would pass; counting hints (4 < 5) must not.
    const rows = ['###......', '###......', '.........', '.........', '.........', '.........', '.........', '......###', '......###'];
    const errors = validateKakuroLayout(mask(rows));

    expect(errors).toContain('4 interior hint cells is below the 9×9 floor of 5');
  });
});
