import { describe, expect, it } from 'vitest';
import { buildDisplayCells, skyscrapersTracks } from './skyscrapers-types';

describe('skyscrapersTracks', () => {
  it('adds a gutter cell on each side of the interior', () => {
    expect(skyscrapersTracks(5)).toBe(7);
    expect(skyscrapersTracks(9)).toBe(11);
  });
});

describe('buildDisplayCells', () => {
  it('draws N+2 tracks per axis for interior size N', () => {
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
