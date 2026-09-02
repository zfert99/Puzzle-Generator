import type { DeductionReport } from './hint-tools';
import type { HintRun } from './agent';
import type { EvalState } from './eval-states';

/** One graded run. `null` means the metric does not apply to this state's kind. */
export interface Grade {
  id: string;
  kind: EvalState['kind'];
  parsed: boolean;
  calledOracle: boolean;
  /** has_deduction only: the named cells belong to one deduction the oracle lists. */
  valid: boolean | null;
  /** has_deduction only: the named strategy matches that deduction's label. */
  labelCorrect: boolean | null;
  /** has_deduction only: the explanation states the digit a placement deduction would place. */
  leaked: boolean | null;
  /** none only: the agent answered with no hint. */
  refusedCorrectly: boolean | null;
  strategy: string | null;
  cells: string[];
}

/**
 * Grades a run against the oracle for its state. Validity is a subset test on
 * cells: for singles the deduction has exactly one cell, for elimination
 * techniques the oracle reports the union of every instance one pass finds, so
 * a hint naming a subset of those cells is still one real step.
 *
 * The leak check is a heuristic: it strips r#c# labels from the explanation and
 * looks for the placed digit as a standalone number. It only applies when the
 * matched deduction is a placement, because for elimination techniques naming
 * the eliminated digit is how the technique is explained.
 */
export function gradeRun(state: EvalState, run: HintRun, oracle: DeductionReport[]): Grade {
  const response = run.response;
  const base = {
    id: state.id,
    kind: state.kind,
    parsed: response !== null,
    calledOracle: run.toolCalls.includes('list_available_deductions'),
    strategy: response?.hint?.strategy ?? null,
    cells: response?.hint?.cells ?? [],
  };

  if (state.kind === 'none') {
    return { ...base, valid: null, labelCorrect: null, leaked: null, refusedCorrectly: response !== null && response.hint === null };
  }

  const hint = response?.hint;
  if (!hint || hint.cells.length === 0) {
    return { ...base, valid: false, labelCorrect: false, leaked: false, refusedCorrectly: null };
  }

  const cells = hint.cells.map(normalizeCell);
  const matches = oracle.filter(d => {
    const own = new Set([...d.placements, ...d.eliminations].map(x => x.cell));
    return cells.every(c => own.has(c));
  });
  const valid = matches.length > 0;
  const labelCorrect = matches.some(d => normalizeStrategy(d.strategy) === normalizeStrategy(hint.strategy));
  const leaked = matches.some(d => d.placements.some(p => mentionsDigit(hint.explanation, p.digit)));

  return { ...base, valid, labelCorrect, leaked, refusedCorrectly: null };
}

export interface Summary {
  model: string;
  n: number;
  nHasDeduction: number;
  nNone: number;
  parseRate: number;
  oracleCallRate: number;
  validity: number;
  labelAccuracy: number;
  leakRate: number;
  refusalAccuracy: number;
  unnecessaryRefusals: number;
  hallucinatedHints: number;
}

/** The four numbers the writeup reports, plus the two failure counts behind them. */
export function summarize(model: string, grades: Grade[]): Summary {
  const has = grades.filter(g => g.kind === 'has_deduction');
  const none = grades.filter(g => g.kind === 'none');
  const rate = (xs: Grade[], pick: (g: Grade) => boolean | null) =>
    xs.length === 0 ? 0 : xs.filter(g => pick(g) === true).length / xs.length;
  return {
    model,
    n: grades.length,
    nHasDeduction: has.length,
    nNone: none.length,
    parseRate: rate(grades, g => g.parsed),
    oracleCallRate: rate(grades, g => g.calledOracle),
    validity: rate(has, g => g.valid),
    labelAccuracy: rate(has, g => g.labelCorrect),
    leakRate: rate(has, g => g.leaked),
    refusalAccuracy: rate(none, g => g.refusedCorrectly),
    unnecessaryRefusals: has.filter(g => g.parsed && g.cells.length === 0).length,
    hallucinatedHints: none.filter(g => g.parsed && g.refusedCorrectly === false).length,
  };
}

export function formatSummary(s: Summary): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  return [
    `model: ${s.model}`,
    `n = ${s.n} (${s.nHasDeduction} with a deduction available, ${s.nNone} with none)`,
    `validity (named cells are one real deduction):   ${pct(s.validity)}`,
    `strategy label correct:                          ${pct(s.labelAccuracy)}`,
    `leak (stated the digit for a placement):         ${pct(s.leakRate)}`,
    `refusal on empty states:                         ${pct(s.refusalAccuracy)}  (${s.hallucinatedHints} invented hints)`,
    `unnecessary refusals on solvable states:         ${s.unnecessaryRefusals}`,
    `parsed / called oracle:                          ${pct(s.parseRate)} / ${pct(s.oracleCallRate)}`,
  ].join('\n');
}

function normalizeCell(cell: string): string {
  return cell.trim().toLowerCase().replace(/\s+/g, '');
}

function normalizeStrategy(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
}

function mentionsDigit(text: string, digit: number): boolean {
  const withoutCells = text.replace(/r\s*\d\s*c\s*\d/gi, ' ').replace(/\b(row|column|col|box)\s*\d\b/gi, ' ');
  return new RegExp(`(^|[^\\d])${digit}([^\\d]|$)`).test(withoutCells);
}
