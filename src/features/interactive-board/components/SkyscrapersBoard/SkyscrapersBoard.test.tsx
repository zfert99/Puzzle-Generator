// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { deriveClues, type SkyscrapersPuzzle } from '@/features/engine/skyscrapers/skyscrapers-types';
import { SkyscrapersBoard, gutterLabel } from './SkyscrapersBoard';

/** A 4×4 puzzle with every clue present except the right side, which is all blank. */
function puzzle4(): SkyscrapersPuzzle {
  const solution = [
    [1, 2, 3, 4],
    [2, 1, 4, 3],
    [3, 4, 1, 2],
    [4, 3, 2, 1],
  ];
  const clues = deriveClues(solution);
  clues.right = [0, 0, 0, 0];
  return { variant: 'skyscrapers', gridSize: 4, grid: solution.map((row) => row.map(() => 0)), solution, clues, difficulty: 'unrated' };
}

function puzzleOfSize(size: 5 | 6 | 7): SkyscrapersPuzzle {
  // A cyclic Latin square is enough for a rendering test; its clues are derived, never typed.
  const solution = Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => ((r + c) % size) + 1));
  return { variant: 'skyscrapers', gridSize: size, grid: solution.map((row) => row.map(() => 0)), solution, clues: deriveClues(solution), difficulty: 'unrated' };
}

describe('gutterLabel', () => {
  it('spells the direction a clue on that side reads in, and the clue when there is one', () => {
    expect(gutterLabel('top', 2)).toBe('Clue cell, looking down from the top of column 3, blank');
    expect(gutterLabel('bottom', 0, 3)).toBe('Clue 3, looking up from the bottom of column 1');
    expect(gutterLabel('left', 4, 1)).toBe('Clue 1, looking right from the left of row 5');
    expect(gutterLabel('right', 1)).toBe('Clue cell, looking left from the right of row 2, blank');
  });
});

describe('SkyscrapersBoard (looks-only, V1)', () => {
  it('renders an N×N play area of empty gridcells inside 4N read-only gutter cells', () => {
    render(<SkyscrapersBoard puzzle={puzzleOfSize(6)} />);

    expect(screen.getByRole('grid', { name: 'Skyscrapers board, 6 by 6' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(8);
    expect(screen.getAllByRole('gridcell', { name: /empty$/ })).toHaveLength(36);
    expect(screen.getAllByRole('gridcell', { name: /^Clue/ })).toHaveLength(24);
  });

  it('shows each present clue as a digit on its side, and leaves blank clues empty', () => {
    render(<SkyscrapersBoard puzzle={puzzle4()} />);

    // top clues of the 4×4 square are 4, 2, 2, 1; the left side's first clue is 4; right is blank.
    expect(screen.getByRole('gridcell', { name: 'Clue 4, looking down from the top of column 1' })).toHaveTextContent('4');
    expect(screen.getByRole('gridcell', { name: 'Clue 1, looking down from the top of column 4' })).toHaveTextContent('1');
    expect(screen.getByRole('gridcell', { name: 'Clue 4, looking right from the left of row 1' })).toHaveTextContent('4');
    const blanks = screen.getAllByRole('gridcell', { name: /looking left from the right of row \d, blank$/ });
    expect(blanks).toHaveLength(4);
    blanks.forEach((cell) => expect(cell).toBeEmptyDOMElement());
    expect(screen.getAllByRole('gridcell', { name: /^Clue \d/ })).toHaveLength(12);
  });

  it('exposes one rectangular grid to assistive technology: every row has N+2 cells, indexed', () => {
    render(<SkyscrapersBoard puzzle={puzzleOfSize(5)} />);

    const grid = screen.getByRole('grid');
    expect(grid).toHaveAttribute('aria-rowcount', '7');
    expect(grid).toHaveAttribute('aria-colcount', '7');
    const rows = screen.getAllByRole('row');
    rows.forEach((row, r) => {
      expect(row).toHaveAttribute('aria-rowindex', String(r + 1));
      const cells = row.querySelectorAll('[role="gridcell"]');
      expect(cells).toHaveLength(7);
      cells.forEach((cell, c) => expect(cell).toHaveAttribute('aria-colindex', String(c + 1)));
    });
    // The four corners are empty read-only cells, not hidden elements.
    const corners = [rows[0], rows[6]].flatMap((row) => {
      const cells = row.querySelectorAll('[role="gridcell"]');
      return [cells[0], cells[6]];
    });
    corners.forEach((corner) => {
      expect(corner).toHaveAttribute('aria-readonly', 'true');
      expect(corner).not.toHaveAttribute('aria-label');
    });
  });

  it('draws the frame on the play cells that touch the gutter, and nowhere else', () => {
    render(<SkyscrapersBoard puzzle={puzzle4()} />);

    const play = (r: number, c: number) =>
      screen.getByRole('gridcell', { name: `Row ${r}, column ${c}, empty` }).className;
    const frames = (cls: string) => (cls.match(/frame(Top|Bottom|Left|Right)/g) ?? []).sort();

    expect(frames(play(1, 1))).toEqual(['frameLeft', 'frameTop']);
    expect(frames(play(1, 4))).toEqual(['frameRight', 'frameTop']);
    expect(frames(play(4, 1))).toEqual(['frameBottom', 'frameLeft']);
    expect(frames(play(4, 4))).toEqual(['frameBottom', 'frameRight']);
    expect(frames(play(1, 2))).toEqual(['frameTop']);
    expect(frames(play(3, 4))).toEqual(['frameRight']);
    expect(frames(play(2, 3))).toEqual([]);
  });

  it('sizes the CSS grid from the track count', () => {
    render(<SkyscrapersBoard puzzle={puzzleOfSize(7)} />);

    expect(screen.getByRole('grid').getAttribute('style')).toContain('--tracks: 9');
  });
});
