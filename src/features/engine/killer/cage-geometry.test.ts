import { describe, expect, it } from 'vitest';
import { computeCageOutline } from './cage-geometry';
import type { Cage } from './killer-types';

const I = 0.09;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe('computeCageOutline', () => {
  it('draws a 4-line inset box for a 1-cell cage', () => {
    const cages: Cage[] = [{ id: 0, sum: 5, cells: [0] }];
    const { lines } = computeCageOutline(cages, 4, I);
    expect(lines).toHaveLength(4);
    // Every coordinate stays inside the cell's inset box (all corners convex).
    for (const l of lines) {
      for (const v of [l.x1, l.y1, l.x2, l.y2]) {
        expect(v).toBeGreaterThanOrEqual(I - 1e-9);
        expect(v).toBeLessThanOrEqual(1 - I + 1e-9);
      }
    }
  });

  it('closes the inner corner of an L-shaped cage (reflex segments meet)', () => {
    // L: (0,0)(1,0)(1,1). The inner corner is at grid point (1,1); the (0,0) right edge and the
    // (1,1) top edge should both reach the meeting point (1 - I, 1 + I).
    const cages: Cage[] = [{ id: 0, sum: 8, cells: [0, 4, 5] }];
    const { lines } = computeCageOutline(cages, 4, I);

    const vertical = lines.find(
      (l) =>
        near(l.x1, l.x2) &&
        near(l.x1, 1 - I) &&
        near(Math.min(l.y1, l.y2), I) &&
        near(Math.max(l.y1, l.y2), 1 + I),
    );
    const horizontal = lines.find(
      (l) =>
        near(l.y1, l.y2) &&
        near(l.y1, 1 + I) &&
        near(Math.min(l.x1, l.x2), 1 - I) &&
        near(Math.max(l.x1, l.x2), 2 - I),
    );

    expect(vertical).toBeDefined(); // (0,0) right edge, extended down past the cell to meet
    expect(horizontal).toBeDefined(); // (1,1) top edge, extended left past the cell to meet
  });

  it('places each sum at its cage anchor (lowest-index) cell', () => {
    const cages: Cage[] = [{ id: 0, sum: 12, cells: [5, 4, 8] }];
    const { sums } = computeCageOutline(cages, 4, I);
    // anchor = min(5,4,8) = 4 → row 1, col 0
    expect(sums).toEqual([{ col: 0, row: 1, value: 12 }]);
  });
});
