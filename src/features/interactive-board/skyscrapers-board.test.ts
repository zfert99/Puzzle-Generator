import { describe, expect, it } from 'vitest';
import { deriveClues } from '@/features/engine/skyscrapers/skyscrapers-types';
import { describeSkyscraperClue, skyscraperClueState } from './skyscrapers-board';

const SQUARE = [
  [1, 2, 3, 4],
  [2, 1, 4, 3],
  [3, 4, 1, 2],
  [4, 3, 2, 1],
];

describe('describeSkyscraperClue', () => {
  it('spells direction and state, and names a blank', () => {
    expect(describeSkyscraperClue('top', 1, 3)).toBe('Clue 3, looking down from the top of column 2, open');
    expect(describeSkyscraperClue('left', 0, 4, 'satisfied')).toBe('Clue 4, looking right from the left of row 1, satisfied');
    expect(describeSkyscraperClue('right', 2, 1, 'violated')).toBe('Clue 1, looking left from the right of row 3, violated');
    expect(describeSkyscraperClue('bottom', 3, 2, 'open', true)).toBe('Clue 2, looking up from the bottom of column 4, marked done');
    expect(describeSkyscraperClue('bottom', 3, 0)).toBe('Clue cell, looking up from the bottom of column 4, blank');
  });
});

describe('skyscraperClueState', () => {
  it('reads the clue and judges its line from the clue end', () => {
    const clues = deriveClues(SQUARE);
    const grid = SQUARE.map((row) => row.map(() => 0));
    expect(skyscraperClueState(clues, grid, 'left', 0)).toEqual({ clue: 4, status: 'open' });

    grid[0] = [1, 2, 3, 4];
    expect(skyscraperClueState(clues, grid, 'left', 0)).toEqual({ clue: 4, status: 'satisfied' });
    expect(skyscraperClueState(clues, grid, 'right', 0)).toEqual({ clue: 1, status: 'satisfied' });

    grid[1] = [4, 0, 0, 0];
    expect(skyscraperClueState(clues, grid, 'left', 1)).toEqual({ clue: 2, status: 'violated' });
    expect(skyscraperClueState(clues, grid, 'top', 0)).toEqual({ clue: 4, status: 'violated' });
  });
});
