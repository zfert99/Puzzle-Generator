import { describe, it, expect } from 'vitest';
import { HumanSolver } from '@/features/engine/human-solver';
import { STRATEGY_NAMES } from '@/features/engine/deductions';
import { parseGrid, gridToString, cellLabel, describeGridState, createHintTools, DEFAULT_PUZZLE } from './hint-tools';

describe('parseGrid', () => {
  it('round-trips the default puzzle', () => {
    expect(gridToString(parseGrid(DEFAULT_PUZZLE))).toBe(DEFAULT_PUZZLE);
    expect(parseGrid(DEFAULT_PUZZLE)).toHaveLength(9);
  });

  it('accepts "." as empty and infers size from length', () => {
    const grid = parseGrid('1.......' + '.'.repeat(8));
    expect(grid).toHaveLength(4);
    expect(grid[0][0]).toBe(1);
  });

  it('rejects bad lengths and out-of-range digits', () => {
    expect(() => parseGrid('123')).toThrow(/16, 36 or 81/);
    expect(() => parseGrid('5' + '0'.repeat(15))).toThrow(/Bad character/);
  });
});

describe('createHintTools', () => {
  const solver = new HumanSolver(parseGrid(DEFAULT_PUZZLE));
  const tools = createHintTools(solver);

  it('describes the grid with 1-indexed rows and candidates for empty cells', () => {
    const text = describeGridState(solver);
    expect(text).toMatch(/^9x9 grid, \d+ empty cells/);
    expect(text).toContain('1 . 6 7 |');
    expect(text).toMatch(/r1c1: \d+/);
  });

  it('reports deductions with known strategy labels and r#c# cells', () => {
    const deductions = tools.listAvailableDeductions();
    expect(deductions.length).toBeGreaterThan(0);
    for (const d of deductions) {
      expect(STRATEGY_NAMES).toContain(d.strategy);
      for (const p of [...d.placements, ...d.eliminations]) expect(p.cell).toMatch(/^r[1-9]c[1-9]$/);
    }
    expect(deductions.some(d => d.strategy === 'Hidden Single' && d.house)).toBe(true);
  });

  it('labels cells 1-indexed', () => {
    expect(cellLabel(0, 0)).toBe('r1c1');
    expect(cellLabel(8, 8)).toBe('r9c9');
  });
});
