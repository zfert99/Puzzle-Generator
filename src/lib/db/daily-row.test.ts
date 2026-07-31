import { describe, expect, it } from 'vitest';
import { generateSudoku } from '@/features/engine/sudoku';
import { generateKillerSudoku } from '@/features/engine/killer/killer-sudoku';
import { generateCalcSudoku } from '@/features/engine/calc/calc-sudoku';
import type { Grid } from './schema';
import {
  countClues,
  difficultyForKey,
  formatDailyKey,
  isDailyDifficulty,
  isEligible,
  getProfile,
  rollDailyAssignment,
  toDailyPuzzleRow,
  toUtcDateString,
  VARIANTS,
  STANDARD_RUNGS,
  type DailySize,
  type Variant,
} from './daily-row';

/** Deterministic PRNG so the (randomized) roller is testable. */
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALL_SIZES: DailySize[] = [4, 6, 9];

describe('countClues', () => {
  it('counts only non-zero cells', () => {
    const grid: Grid = [
      [1, 0, 3],
      [0, 0, 0],
      [4, 5, 0],
    ];
    expect(countClues(grid)).toBe(4);
  });

  it('returns 0 for an empty grid', () => {
    expect(countClues([[0, 0], [0, 0]])).toBe(0);
  });
});

describe('toUtcDateString', () => {
  it('formats a Date as YYYY-MM-DD in UTC regardless of local offset', () => {
    const instant = new Date('2026-07-11T23:30:00.000Z');
    expect(toUtcDateString(instant)).toBe('2026-07-11');
  });
});

describe('isEligible / getProfile coverage (Risk #1)', () => {
  it('every eligible (variant, size, difficulty) has a profile row, and vice versa', () => {
    for (const variant of VARIANTS) {
      for (const size of ALL_SIZES) {
        for (const difficulty of STANDARD_RUNGS) {
          const eligible = isEligible(variant, size, difficulty);
          const hasProfile = getProfile(variant, size, difficulty) !== undefined;
          expect(hasProfile, `${variant}-${size}-${difficulty}`).toBe(eligible);
        }
      }
    }
  });

  it('encodes the Killer-4×4-is-easy-only rule', () => {
    expect(isEligible('killer', 4, 'easy')).toBe(true);
    expect(isEligible('killer', 4, 'medium')).toBe(false);
    expect(isEligible('killer', 4, 'hard')).toBe(false);
    expect(isEligible('killer', 6, 'hard')).toBe(true); // full e/m/h at 6×6
  });

  it('has no expert/extreme minis and always allows 9×9', () => {
    for (const variant of VARIANTS) {
      expect(isEligible(variant, 4, 'expert')).toBe(false);
      expect(isEligible(variant, 6, 'extreme')).toBe(false);
      for (const difficulty of STANDARD_RUNGS) expect(isEligible(variant, 9, difficulty)).toBe(true);
    }
  });
});

describe('rollDailyAssignment', () => {
  it('rolls 3 standard (distinct rungs, all 3 types) + 3 minis, all eligible', () => {
    const slots = rollDailyAssignment(mulberry32(1));
    expect(slots).toHaveLength(6);

    const standard = slots.filter((s) => s.section === 'standard');
    const minis = slots.filter((s) => s.section === 'mini');
    expect(standard).toHaveLength(3);
    expect(minis).toHaveLength(3);

    // Standard: 3 distinct rungs, keyed by rung, 9×9, one per type.
    expect(new Set(standard.map((s) => s.key)).size).toBe(3);
    expect(standard.every((s) => s.gridSize === 9 && s.key === s.difficulty)).toBe(true);
    expect(new Set(standard.map((s) => s.variant))).toEqual(new Set(VARIANTS));

    // Minis: the three tier slots, keyed mini-<tier>.
    expect(minis.map((s) => s.key).sort()).toEqual(['mini-easy', 'mini-hard', 'mini-medium']);

    // Every slot is a real, generatable board, and all 6 keys are distinct.
    expect(slots.every((s) => isEligible(s.variant, s.gridSize, s.difficulty))).toBe(true);
    expect(new Set(slots.map((s) => s.key)).size).toBe(6);
  });

  it('holds its invariants across many seeds (incl. the Killer mini constraint)', () => {
    for (let seed = 0; seed < 300; seed++) {
      const slots = rollDailyAssignment(mulberry32(seed));
      expect(slots).toHaveLength(6);
      // Distinct standard rungs; all three types present in the standard set.
      const standard = slots.filter((s) => s.section === 'standard');
      expect(new Set(standard.map((s) => s.difficulty)).size).toBe(3);
      expect(new Set(standard.map((s) => s.variant))).toEqual(new Set(VARIANTS));
      // Every slot eligible — so a Killer mini can only ever be easy-4×4 or a 6×6 board.
      for (const s of slots) {
        expect(isEligible(s.variant, s.gridSize, s.difficulty), JSON.stringify(s)).toBe(true);
        if (s.variant === 'killer' && s.gridSize === 4) expect(s.difficulty).toBe('easy');
      }
    }
  });

  it('is deterministic for a given RNG seed', () => {
    expect(rollDailyAssignment(mulberry32(42))).toEqual(rollDailyAssignment(mulberry32(42)));
  });
});

describe('isDailyDifficulty', () => {
  it('accepts active slot keys', () => {
    for (const key of [...STANDARD_RUNGS, 'mini-easy', 'mini-medium', 'mini-hard']) {
      expect(isDailyDifficulty(key)).toBe(true);
    }
  });

  it('accepts retired keys for archive replay (incl. legacy killer)', () => {
    for (const key of ['killer', 'killer-expert', 'killer6-hard', 'mini4-easy', 'calc9-extreme', 'calc6-medium']) {
      expect(isDailyDifficulty(key)).toBe(true);
    }
  });

  it('rejects junk', () => {
    for (const value of ['nope', 'mini-expert', '', 42, null, undefined]) {
      expect(isDailyDifficulty(value)).toBe(false);
    }
  });
});

describe('difficultyForKey', () => {
  it('resolves active keys', () => {
    expect(difficultyForKey('hard')).toBe('hard');
    expect(difficultyForKey('extreme')).toBe('extreme');
    expect(difficultyForKey('mini-easy')).toBe('easy');
    expect(difficultyForKey('mini-hard')).toBe('hard');
  });

  /**
   * Anti-cheat regression: the solve floor and bot time are looked up BY RUNG, so a retired key
   * that resolved to no rung would silently get the permissive default floor — and retired keys
   * are still solvable on the cutover date, which holds both old and new rows.
   */
  it('resolves retired keys to their real rung (not the permissive default)', () => {
    expect(difficultyForKey('killer-extreme')).toBe('extreme');
    expect(difficultyForKey('calc9-expert')).toBe('expert');
    expect(difficultyForKey('mini4-easy')).toBe('easy');
    expect(difficultyForKey('killer6-medium')).toBe('medium');
    expect(difficultyForKey('mini6-hard')).toBe('hard');
  });

  it('maps the legacy `killer` key to medium, preserving its historical 30s floor', () => {
    expect(difficultyForKey('killer')).toBe('medium');
    expect(getProfile('killer', 9, difficultyForKey('killer'))!.minSolveMs).toBe(30_000);
  });

  it('gives every retired key a real profile floor', () => {
    const retired: [string, Variant, DailySize][] = [
      ['killer-extreme', 'killer', 9],
      ['killer6-medium', 'killer', 6],
      ['calc9-expert', 'calc', 9],
      ['calc4-hard', 'calc', 4],
      ['mini4-easy', 'classic', 4],
      ['mini6-hard', 'classic', 6],
    ];
    for (const [key, variant, size] of retired) {
      expect(getProfile(variant, size, difficultyForKey(key)), key).toBeDefined();
    }
  });
});

describe('formatDailyKey', () => {
  it('labels active keys by difficulty (type composition is UI-layer)', () => {
    expect(formatDailyKey('hard')).toBe('hard');
    expect(formatDailyKey('mini-easy')).toBe('mini easy');
  });

  it('keeps retired keys prettified for archived rows', () => {
    expect(formatDailyKey('killer')).toBe('killer');
    expect(formatDailyKey('killer-expert')).toBe('killer expert');
    expect(formatDailyKey('killer6-hard')).toBe('killer 6×6 hard');
    expect(formatDailyKey('mini6-hard')).toBe('6×6 hard');
    expect(formatDailyKey('calc6-hard')).toBe('keisan 6×6 hard');
    expect(formatDailyKey('calc9-extreme')).toBe('keisan extreme');
  });
});

describe('toDailyPuzzleRow', () => {
  it('maps a classic puzzle: variant classic, clue count, no cages', () => {
    const puzzle = generateSudoku('easy');
    const row = toDailyPuzzleRow(puzzle, '2026-07-11', 'easy');

    expect(row.date).toBe('2026-07-11');
    expect(row.difficulty).toBe('easy');
    expect(row.variant).toBe('classic');
    expect(row.grid).toBe(puzzle.grid);
    expect(row.solution).toBe(puzzle.solution);
    expect(row.clueCount).toBe(countClues(puzzle.grid));
    expect(row.cages).toBeNull();
    expect(row.clueCount).toBeGreaterThan(16);
    expect(row.clueCount).toBeLessThan(81);
  });

  it('maps a Killer puzzle under a rung slot key: variant killer, cages, cage count', () => {
    const puzzle = generateKillerSudoku('medium');
    const row = toDailyPuzzleRow(puzzle, '2026-07-17', 'hard'); // rung key holds a rolled type now

    expect(row.difficulty).toBe('hard'); // the slot key, not the engine difficulty
    expect(row.variant).toBe('killer');
    expect(row.cages).toBe(puzzle.cages);
    expect(row.clueCount).toBe(puzzle.cages.length);
    expect(row.grid.flat().every((v) => v === 0)).toBe(true); // no givens; cages are the clue
    expect(countClues(row.solution)).toBe(81);
  });

  it('maps a Keisan puzzle variant-safely under a mini slot key: op+target cages', () => {
    const puzzle = generateCalcSudoku('hard', { gridSize: 6 });
    const row = toDailyPuzzleRow(puzzle, '2026-07-26', 'mini-hard');

    expect(row.difficulty).toBe('mini-hard');
    expect(row.variant).toBe('calc');
    expect(row.cages).toBe(puzzle.cages);
    expect(row.cages?.[0]).toHaveProperty('op');
    expect(row.cages?.[0]).toHaveProperty('target');
    expect(row.clueCount).toBe(puzzle.cages.length);
    expect(row.grid.flat().every((v) => v === 0)).toBe(true);
  });
});
