import { describe, expect, it } from 'vitest';
import { isLatinSquare } from '../grid-utils';
import {
  generateUniqueSkyscrapers,
  randomLatinSquare,
  removeClues,
  repairToUnique,
  tierOf,
} from './skyscrapers-generator';
import { classifySkyscrapers } from './skyscrapers-logical-solver';
import { isSkyscrapersUnique } from './skyscrapers-solver';
import { SKYSCRAPERS_SIZES, deriveClues, presentClueCount, validateSkyscrapers } from './skyscrapers-types';

/** A tiny seeded PRNG so a test can say "same seed → same puzzle". */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('tierOf', () => {
  it('maps the ladder to tiers 1..5 in order', () => {
    expect(['easy', 'medium', 'hard', 'expert', 'extreme'].map((l) => tierOf(l as 'easy'))).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('randomLatinSquare', () => {
  it('is a Latin square at every served size, and seeded', () => {
    for (const size of SKYSCRAPERS_SIZES) expect(isLatinSquare(randomLatinSquare(size, mulberry32(7)))).toBe(true);
    expect(randomLatinSquare(6, mulberry32(42))).toEqual(randomLatinSquare(6, mulberry32(42)));
  });
});

describe('repairToUnique', () => {
  it('turns a random square into one whose 4N clues are unique, keeping it Latin', () => {
    for (const size of SKYSCRAPERS_SIZES) {
      const repaired = repairToUnique(size, { rng: mulberry32(size) });
      expect(repaired.solutions).toBe(1);
      expect(isLatinSquare(repaired.solution)).toBe(true);
      expect(isSkyscrapersUnique({ gridSize: size, clues: deriveClues(repaired.solution) })).toBe(true);
    }
  });

  it('repairs the research\'s non-unique 4×4 (two squares share all 16 clues) rather than rejecting it', () => {
    const start = [
      [1, 2, 3, 4],
      [2, 1, 4, 3],
      [3, 4, 1, 2],
      [4, 3, 2, 1],
    ];
    expect(isSkyscrapersUnique({ gridSize: 4, clues: deriveClues(start) })).toBe(false);
    const repaired = repairToUnique(4, { rng: mulberry32(3), start });
    expect(repaired.solutions).toBe(1);
    expect(repaired.swaps + repaired.restarts).toBeGreaterThan(0);
  });

  it('gives up cleanly at the wall-clock cap instead of hanging', () => {
    const repaired = repairToUnique(7, { rng: mulberry32(1), msCap: 0 });
    expect(repaired.swaps).toBe(0);
    expect(repaired.ms).toBeLessThan(1000);
  });
});

describe('removeClues', () => {
  it('keeps the puzzle unique and never blanks below what uniqueness allows', () => {
    const { solution } = repairToUnique(6, { rng: mulberry32(11) });
    const removed = removeClues(solution, { rng: mulberry32(12) });
    expect(isSkyscrapersUnique({ gridSize: 6, clues: removed.clues })).toBe(true);
    expect(removed.kept).toBe(presentClueCount(removed.clues));
    expect(removed.kept).toBeLessThan(24);
    // Every blank is load-bearing: restoring none is needed, but blanking any kept clue breaks uniqueness.
    for (const side of ['top', 'bottom', 'left', 'right'] as const) {
      for (let i = 0; i < 6; i++) {
        if (removed.clues[side][i] === 0) continue;
        const probe = { ...removed.clues, [side]: removed.clues[side].map((v, k) => (k === i ? 0 : v)) };
        expect(isSkyscrapersUnique({ gridSize: 6, clues: probe })).toBe(false);
      }
    }
  });

  it('with a target tier, never lets the ladder tier exceed it, and reports the floor when the square is already above it', () => {
    let belowOrAt = 0;
    for (let seed = 20; seed < 32; seed++) {
      const { solution } = repairToUnique(5, { rng: mulberry32(seed) });
      const removed = removeClues(solution, { rng: mulberry32(seed + 100), targetTier: 2 });
      const graded = classifySkyscrapers({ gridSize: 5, clues: removed.clues }).tier;
      expect(graded).toBe(removed.tier);
      if (removed.tier !== null && removed.tier <= 2) {
        belowOrAt += 1;
        expect(isSkyscrapersUnique({ gridSize: 5, clues: removed.clues })).toBe(true);
      } else {
        // The all-clue floor was above the target: nothing was removed.
        expect(removed.kept).toBe(20);
      }
    }
    expect(belowOrAt).toBeGreaterThan(0); // E3: 98% of 5×5 squares have a floor ≤ medium
  });
});

describe('generateUniqueSkyscrapers', () => {
  it('produces a valid, unique, classifier-labelled puzzle at every served size', () => {
    for (const size of SKYSCRAPERS_SIZES) {
      const generated = generateUniqueSkyscrapers({ gridSize: size, rng: mulberry32(size * 7) });
      expect(generated).not.toBeNull();
      const { puzzle, stats } = generated!;
      expect(validateSkyscrapers(puzzle)).toEqual([]);
      expect(puzzle.grid.flat().every((v) => v === 0)).toBe(true); // no givens (D3)
      expect(isSkyscrapersUnique({ gridSize: size, clues: puzzle.clues })).toBe(true);
      expect(puzzle.difficulty).toBe(classifySkyscrapers({ gridSize: size, clues: puzzle.clues }).difficulty);
      expect(stats.rounds).toBeGreaterThanOrEqual(1);
      expect(stats.removal.kept).toBe(presentClueCount(puzzle.clues));
    }
  });

  it('is reproducible from a seed', () => {
    const a = generateUniqueSkyscrapers({ gridSize: 6, rng: mulberry32(99) })!.puzzle;
    const b = generateUniqueSkyscrapers({ gridSize: 6, rng: mulberry32(99) })!.puzzle;
    expect(a).toEqual(b);
  });

  it('bounds the removal by the target tier: a medium request never serves hard or above', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const generated = generateUniqueSkyscrapers({ gridSize: 6, rng: mulberry32(seed), targetTier: 2 });
      expect(generated).not.toBeNull();
      expect(['easy', 'medium']).toContain(generated!.puzzle.difficulty);
    }
  });

  it('returns null, not a half-made puzzle, when the budget is already spent', () => {
    expect(generateUniqueSkyscrapers({ gridSize: 6, timeBudgetMs: 0 })).toBeNull();
    expect(generateUniqueSkyscrapers({ gridSize: 6, maxRounds: 0 })).toBeNull();
  });

  it('gives up after maxFloorMisses squares whose all-clue floor sits above the target (no 7×7 has an easy floor — E3)', () => {
    const started = performance.now();
    const generated = generateUniqueSkyscrapers({ gridSize: 7, rng: mulberry32(5), targetTier: 1, maxRounds: 100, maxFloorMisses: 2 });
    expect(generated).toBeNull();
    expect(performance.now() - started).toBeLessThan(10_000);
  });
});
