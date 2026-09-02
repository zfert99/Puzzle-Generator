import { describe, it, expect } from 'vitest';
import { gradeRun, summarize } from './eval-grade';
import type { HintRun } from './agent';
import type { EvalState } from './eval-states';
import type { DeductionReport } from './hint-tools';

const oracle: DeductionReport[] = [
  { strategy: 'Hidden Single', tier: 'basic', placements: [{ cell: 'r5c6', digit: 8 }], eliminations: [], house: 'row 5' },
  { strategy: 'Naked Pair', tier: 'basic', placements: [], eliminations: [{ cell: 'r1c2', digit: 3 }, { cell: 'r1c3', digit: 3 }] },
];
const solvable: EvalState = { id: 's', grid: '0'.repeat(81), kind: 'has_deduction', difficulty: 'easy' };
const stuck: EvalState = { id: 'n', grid: '0'.repeat(81), kind: 'none', difficulty: 'medium' };

function run(hint: HintRun['response'], toolCalls = ['list_available_deductions']): HintRun {
  return { grid: '', model: 'fake', response: hint, rawText: '', toolCalls, stopReason: 'end_turn', usage: { input: 0, output: 0 } };
}

describe('gradeRun', () => {
  it('accepts a correctly labelled single with no digit in the explanation', () => {
    const g = gradeRun(solvable, run({ hint: { strategy: 'hidden single', cells: ['R5C6'], explanation: 'Look at row 5; one digit has a single home.' }, reason: '' }), oracle);
    expect(g).toMatchObject({ valid: true, labelCorrect: true, leaked: false, calledOracle: true });
  });

  it('flags a leaked digit but still counts the deduction as valid', () => {
    const g = gradeRun(solvable, run({ hint: { strategy: 'Hidden Single', cells: ['r5c6'], explanation: 'r5c6 must be 8.' }, reason: '' }), oracle);
    expect(g).toMatchObject({ valid: true, leaked: true });
  });

  it('does not count digits inside cell labels or house names as leaks', () => {
    const g = gradeRun(solvable, run({ hint: { strategy: 'Hidden Single', cells: ['r5c6'], explanation: 'Check r8c8 and box 8 around r5c6.' }, reason: '' }), oracle);
    expect(g.leaked).toBe(false);
  });

  it('marks a subset of an elimination deduction valid and a wrong label as mislabelled', () => {
    const g = gradeRun(solvable, run({ hint: { strategy: 'Hidden Pair', cells: ['r1c2'], explanation: 'Pair in row 1 removes 3.' }, reason: '' }), oracle);
    expect(g).toMatchObject({ valid: true, labelCorrect: false, leaked: false });
  });

  it('marks cells the oracle does not know as invalid', () => {
    const g = gradeRun(solvable, run({ hint: { strategy: 'X-Wing', cells: ['r9c9'], explanation: '' }, reason: '' }), oracle);
    expect(g).toMatchObject({ valid: false, labelCorrect: false });
  });

  it('treats a refusal on a solvable state as invalid, and on a stuck state as correct', () => {
    expect(gradeRun(solvable, run({ hint: null, reason: 'nothing' }), oracle).valid).toBe(false);
    expect(gradeRun(stuck, run({ hint: null, reason: 'nothing' }), []).refusedCorrectly).toBe(true);
    expect(gradeRun(stuck, run({ hint: { strategy: 'Naked Single', cells: ['r1c1'], explanation: '' }, reason: '' }), []).refusedCorrectly).toBe(false);
  });

  it('treats an unparseable response as not parsed and not valid', () => {
    const g = gradeRun(solvable, run(null, []), oracle);
    expect(g).toMatchObject({ parsed: false, valid: false, calledOracle: false });
  });
});

describe('summarize', () => {
  it('reports rates per population and counts both failure kinds', () => {
    const grades = [
      gradeRun(solvable, run({ hint: { strategy: 'Hidden Single', cells: ['r5c6'], explanation: 'ok' }, reason: '' }), oracle),
      gradeRun(solvable, run({ hint: null, reason: 'unsure' }), oracle),
      gradeRun(stuck, run({ hint: null, reason: 'nothing' }), []),
      gradeRun(stuck, run({ hint: { strategy: 'Naked Single', cells: ['r1c1'], explanation: '' }, reason: '' }), []),
    ];
    const s = summarize('fake', grades);
    expect(s).toMatchObject({ n: 4, nHasDeduction: 2, nNone: 2, validity: 0.5, refusalAccuracy: 0.5, unnecessaryRefusals: 1, hallucinatedHints: 1 });
  });
});
