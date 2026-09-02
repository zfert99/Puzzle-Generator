import { describe, it, expect } from 'vitest';
import { HumanSolver } from '@/features/engine/human-solver';
import { listDeductions } from '@/features/engine/deductions';
import { buildEvalStates } from './eval-states';
import { parseGrid } from './hint-tools';

describe('buildEvalStates', () => {
  const states = buildEvalStates({ perDifficulty: 3, noneCount: 3, difficulties: ['easy', 'hard'] });

  it('is deterministic for a seed', () => {
    const again = buildEvalStates({ perDifficulty: 3, noneCount: 3, difficulties: ['easy', 'hard'] });
    expect(again).toEqual(states);
  });

  it('labels every state consistently with the oracle', () => {
    expect(states.filter(s => s.kind === 'has_deduction')).toHaveLength(6);
    expect(states.filter(s => s.kind === 'none')).toHaveLength(3);
    for (const state of states) {
      const available = listDeductions(new HumanSolver(parseGrid(state.grid))).length;
      if (state.kind === 'none') expect(available).toBe(0);
      else expect(available).toBeGreaterThan(0);
    }
  });

  it('samples distinct positions along the walk', () => {
    expect(new Set(states.map(s => s.grid)).size).toBe(states.length);
  });
}, 60_000);
