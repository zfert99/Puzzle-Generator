import { describe, expect, it } from 'vitest';
import { parseKakuroFixture } from '@/features/engine/kakuro/kakuro-fixtures';
import { buildBlocked, buildCellToRuns, buildClues, computeRunPeers, describeClue, kakuroTracks, shareRun } from './kakuro-board';

// The smallest real puzzle: 3×3, black in two opposite corners.
//   # 1 3        across sums: 4 / 7 / 8
//   1 2 4        down sums:   4 / 8 / 7
//   3 5 #
const TINY = parseKakuroFixture(['#13', '124', '35#'], 'easy');

describe('buildBlocked', () => {
  it('marks exactly the cells in no run', () => {
    expect(buildBlocked(TINY.runs, 3)).toEqual([
      [true, false, false],
      [false, false, false],
      [false, false, true],
    ]);
  });

  it('is empty when there are no runs (every other variant)', () => {
    expect(buildBlocked([], 4)).toEqual([]);
  });
});

describe('computeRunPeers', () => {
  it('gives a white cell the other cells of both its runs, and a black cell nothing', () => {
    const peers = computeRunPeers(TINY.runs, 3);

    // Centre (1,1) = index 4: across run [3,4,5], down run [1,4,7].
    expect([...peers[4]].sort((a, b) => a - b)).toEqual([1, 3, 5, 7]);
    // Corner-adjacent (0,1) = index 1: across [1,2], down [1,4,7].
    expect([...peers[1]].sort((a, b) => a - b)).toEqual([2, 4, 7]);
    expect(peers[0]).toEqual([]);
    expect(peers[8]).toEqual([]);
  });

  it('is empty when there are no runs', () => {
    expect(computeRunPeers([], 4)).toEqual([]);
  });
});

describe('buildClues', () => {
  it('puts each sum on the display cell just before its run', () => {
    const tracks = kakuroTracks(3);
    const clues = buildClues(TINY.runs, 3);

    expect(clues).toHaveLength(16);
    // Interior black corner (0,0) → display (1,1): heads the top across run AND the left down run.
    expect(clues[1 * tracks + 1]).toEqual({ across: 4, down: 4 });
    // Gutter above interior column 1 → display (0,2): down 8.
    expect(clues[0 * tracks + 2]).toEqual({ down: 8 });
    // Gutter left of interior row 1 → display (2,0): across 7.
    expect(clues[2 * tracks + 0]).toEqual({ across: 7 });
    // The gutter corner and the bottom-right block head nothing.
    expect(clues[0]).toBeNull();
    expect(clues[3 * tracks + 3]).toBeNull();
    // Only 5 cells carry a clue in total (6 runs; one cell carries two).
    expect(clues.filter(Boolean)).toHaveLength(5);
  });
});

describe('describeClue', () => {
  it('spells out whichever sums exist', () => {
    expect(describeClue({ across: 17, down: 23 })).toBe('Clue: across 17, down 23');
    expect(describeClue({ down: 4 })).toBe('Clue: down 4');
    expect(describeClue(null)).toBe('Blocked cell');
  });
});

describe('buildCellToRuns + shareRun', () => {
  it('answers "same run?" in O(1) and agrees with the peer lists', () => {
    const cellToRuns = buildCellToRuns(TINY.runs, 3);
    const peers = computeRunPeers(TINY.runs, 3);

    expect(cellToRuns).toHaveLength(18);
    expect(cellToRuns[0 * 2]).toBe(-1); // the black corner is in no run
    expect(cellToRuns[4 * 2]).toBe(1); // centre: across run id 1 …
    expect(cellToRuns[4 * 2 + 1]).toBe(4); // … and down run id 4
    for (let a = 0; a < 9; a++) {
      for (let b = 0; b < 9; b++) {
        if (a === b) continue;
        expect(shareRun(cellToRuns, a, b), `${a}-${b}`).toBe(peers[a].includes(b));
      }
    }
    expect(shareRun([], 0, 1)).toBe(false);
  });
});
