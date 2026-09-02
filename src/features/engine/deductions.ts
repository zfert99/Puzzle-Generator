import { HumanSolver } from './human-solver';
import { applyNakedPair, applyHiddenPair, applyPointingPairs } from './strategies/basic';
import { applyXWing, applySwordfish, applyYWing, applyXYZWing } from './strategies/advanced';
import { applyWWing, applyALSXZ, applyAIC } from './strategies/extreme';

export type StrategyTier = 'basic' | 'advanced' | 'extreme';

/** A digit the deduction proves must go in a cell. Coordinates are 0-indexed. */
export interface Placement { r: number; c: number; digit: number }

/** A candidate the deduction proves cannot go in a cell. Coordinates are 0-indexed. */
export interface Elimination { r: number; c: number; digit: number }

/**
 * One logical step a human could take from a given grid state, labelled with the
 * technique that justifies it. A deduction is either a placement (singles) or a
 * set of candidate eliminations (every other technique) — never both, because a
 * placement's ripple eliminations are consequences of the placement, not
 * independent deductions.
 */
export interface Deduction {
  strategy: string;
  tier: StrategyTier;
  placements: Placement[];
  eliminations: Elimination[];
  /** For hidden singles: which house forces the digit ("row 3", "col 7", "box 5"). 1-indexed. */
  house?: string;
}

/**
 * Elimination-only strategies, in the same cheapest-first order `HumanSolver.solve`
 * uses. Each `apply` mutates a solver in place and returns whether it changed
 * anything; the enumerator runs each one on its own clone and diffs the result.
 * Advanced and extreme techniques are 9×9-only, mirroring the solve loop.
 */
const ELIMINATION_STRATEGIES: {
  name: string;
  tier: StrategyTier;
  apply: (solver: HumanSolver) => boolean;
  nineOnly: boolean;
}[] = [
  { name: 'Naked Pair', tier: 'basic', apply: applyNakedPair, nineOnly: false },
  { name: 'Hidden Pair', tier: 'basic', apply: applyHiddenPair, nineOnly: false },
  { name: 'Pointing Pairs', tier: 'basic', apply: applyPointingPairs, nineOnly: false },
  { name: 'X-Wing', tier: 'advanced', apply: applyXWing, nineOnly: true },
  { name: 'Swordfish', tier: 'advanced', apply: applySwordfish, nineOnly: true },
  { name: 'Y-Wing', tier: 'advanced', apply: applyYWing, nineOnly: true },
  { name: 'XYZ-Wing', tier: 'advanced', apply: applyXYZWing, nineOnly: true },
  { name: 'W-Wing', tier: 'extreme', apply: applyWWing, nineOnly: true },
  { name: 'ALS-XZ', tier: 'extreme', apply: applyALSXZ, nineOnly: true },
  { name: 'AIC', tier: 'extreme', apply: applyAIC, nineOnly: true },
];

/** Every strategy label `listDeductions` can emit, for validating an agent's claimed technique. */
export const STRATEGY_NAMES: readonly string[] = [
  'Naked Single',
  'Hidden Single',
  ...ELIMINATION_STRATEGIES.map(s => s.name),
];

/**
 * Copies a solver's grid *and* its candidate bitmasks. Rebuilding from the grid
 * alone would forget every elimination made so far, so a mid-solve state would
 * look easier (or harder) than it really is.
 */
export function cloneSolver(solver: HumanSolver): HumanSolver {
  const clone = new HumanSolver(solver.grid);
  for (let r = 0; r < solver.size; r++) {
    for (let c = 0; c < solver.size; c++) {
      clone.candidates[r][c] = solver.candidates[r][c];
    }
  }
  return clone;
}

/**
 * Enumerates every deduction available in the solver's current state without
 * changing it. `HumanSolver.solve` is a stepper — it applies the first technique
 * that fires and restarts — so it cannot answer "what are all my options here?"
 * This wrapper can, which is what a hint agent and its eval harness need: a
 * ground truth to grade claimed hints against.
 *
 * Singles are enumerated individually (one deduction per cell) because a hint
 * naming any one of them is correct. Elimination techniques are reported once per
 * strategy with the union of everything one pass of that technique removes; the
 * underlying strategy functions apply every instance they find in a single call,
 * so splitting them per instance would mean reimplementing each technique.
 */
export function listDeductions(solver: HumanSolver): Deduction[] {
  if (solver.isSolved()) return [];

  const deductions: Deduction[] = [
    ...listNakedSingles(solver),
    ...listHiddenSingles(solver),
  ];

  for (const strategy of ELIMINATION_STRATEGIES) {
    if (strategy.nineOnly && solver.size !== 9) continue;
    const clone = cloneSolver(solver);
    if (!strategy.apply(clone)) continue;
    const eliminations = diffEliminations(solver, clone);
    if (eliminations.length === 0) continue;
    deductions.push({ strategy: strategy.name, tier: strategy.tier, placements: [], eliminations });
  }

  return deductions;
}

function listNakedSingles(solver: HumanSolver): Deduction[] {
  return solver.getCellsWithNCandidates(1).map(({ r, c, cands }) => ({
    strategy: 'Naked Single',
    tier: 'basic' as const,
    placements: [{ r, c, digit: cands[0] }],
    eliminations: [],
  }));
}

/**
 * A digit with exactly one legal position in a house. Scans each house per digit
 * directly rather than reusing `findAndPlaceHiddenSingle`, which places the first
 * one it finds and stops. The same cell can be reported once per house that
 * forces it; duplicates are collapsed to the first house found.
 */
function listHiddenSingles(solver: HumanSolver): Deduction[] {
  const found: Deduction[] = [];
  const seen = new Set<string>();
  const axes = ['row', 'col', 'box'] as const;

  for (const axis of axes) {
    for (let house = 0; house < solver.size; house++) {
      const cells = solver.getEmptyCellsInHouse(axis, house);
      for (let digit = 1; digit <= solver.size; digit++) {
        const spots = cells.filter(cell => solver.hasCandidate(cell.r, cell.c, digit));
        if (spots.length !== 1) continue;
        const { r, c } = spots[0];
        const key = `${r},${c},${digit}`;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({
          strategy: 'Hidden Single',
          tier: 'basic',
          placements: [{ r, c, digit }],
          eliminations: [],
          house: `${axis} ${house + 1}`,
        });
      }
    }
  }
  return found;
}

function diffEliminations(before: HumanSolver, after: HumanSolver): Elimination[] {
  const eliminations: Elimination[] = [];
  for (let r = 0; r < before.size; r++) {
    for (let c = 0; c < before.size; c++) {
      const removed = before.candidates[r][c] & ~after.candidates[r][c];
      if (removed === 0) continue;
      for (let digit = 1; digit <= before.size; digit++) {
        if (removed & (1 << (digit - 1))) eliminations.push({ r, c, digit });
      }
    }
  }
  return eliminations;
}
