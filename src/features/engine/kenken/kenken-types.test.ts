// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  computeTarget,
  operatorAllowedForCageSize,
  hasAssignableOperator,
  OPERATOR_SYMBOL,
  type KenKenOperator,
} from './kenken-types';

describe('computeTarget', () => {
  it('add is the sum, mul is the product (any cage size)', () => {
    expect(computeTarget('add', [1, 2, 3])).toBe(6);
    expect(computeTarget('mul', [2, 3, 4])).toBe(24);
    expect(computeTarget('add', [5])).toBe(5); // single-cell given
  });

  it('sub and div are order-independent (larger over smaller), two cells', () => {
    expect(computeTarget('sub', [1, 4])).toBe(3);
    expect(computeTarget('sub', [4, 1])).toBe(3);
    expect(computeTarget('div', [6, 2])).toBe(3);
    expect(computeTarget('div', [2, 6])).toBe(3);
  });

  it('throws if sub/div is handed anything other than two digits', () => {
    expect(() => computeTarget('sub', [1, 2, 3])).toThrow(/two-cell/);
    expect(() => computeTarget('div', [4])).toThrow(/two-cell/);
  });
});

describe('operatorAllowedForCageSize', () => {
  it('single-cell cages are givens — no operator is allowed', () => {
    for (const op of ['add', 'sub', 'mul', 'div'] as KenKenOperator[]) {
      expect(operatorAllowedForCageSize(op, 1)).toBe(false);
    }
  });

  it('add/mul work at any size ≥ 2; sub/div only at exactly 2', () => {
    expect(operatorAllowedForCageSize('add', 2)).toBe(true);
    expect(operatorAllowedForCageSize('add', 5)).toBe(true);
    expect(operatorAllowedForCageSize('mul', 4)).toBe(true);
    expect(operatorAllowedForCageSize('sub', 2)).toBe(true);
    expect(operatorAllowedForCageSize('sub', 3)).toBe(false);
    expect(operatorAllowedForCageSize('div', 2)).toBe(true);
    expect(operatorAllowedForCageSize('div', 3)).toBe(false);
  });
});

describe('hasAssignableOperator (the K2 legality invariant)', () => {
  it('a 3+-cell cage needs add or mul in the active set', () => {
    expect(hasAssignableOperator(['sub', 'div'], 3)).toBe(false); // unsatisfiable — would wedge generation
    expect(hasAssignableOperator(['add'], 3)).toBe(true);
    expect(hasAssignableOperator(['mul', 'div'], 4)).toBe(true);
  });

  it('two-cell cages accept any operator; single-cell givens always pass', () => {
    expect(hasAssignableOperator(['sub'], 2)).toBe(true);
    expect(hasAssignableOperator(['div'], 1)).toBe(true); // a given — no operator required
  });
});

describe('OPERATOR_SYMBOL', () => {
  it('maps each operator to its display glyph (− is the minus sign, not a hyphen)', () => {
    expect(OPERATOR_SYMBOL).toEqual({ add: '+', sub: '−', mul: '×', div: '÷' });
    expect(OPERATOR_SYMBOL.sub).toBe('−');
  });
});
