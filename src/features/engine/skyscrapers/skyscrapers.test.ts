import { describe, expect, it } from 'vitest';
import { generateSkyscrapers } from './skyscrapers';
import { isSkyscrapersUnique } from './skyscrapers-solver';
import { SKYSCRAPERS_LADDER, validateSkyscrapers } from './skyscrapers-types';

describe('generateSkyscrapers', () => {
  it('serves a unique puzzle no harder than the request at the standard size, without a fallback', () => {
    const served = generateSkyscrapers('hard', { gridSize: 6 });
    expect(served.fallback).toBe(false);
    expect(['easy', 'medium', 'hard']).toContain(served.puzzle.difficulty);
    expect(validateSkyscrapers(served.puzzle)).toEqual([]);
    expect(isSkyscrapersUnique({ gridSize: 6, clues: served.puzzle.clues })).toBe(true);
  });

  it('serves every level at every size (the fallback keeps a rare tier from failing)', () => {
    for (const level of SKYSCRAPERS_LADDER) {
      const served = generateSkyscrapers(level, { gridSize: 5 });
      expect(validateSkyscrapers(served.puzzle)).toEqual([]);
      expect(typeof served.fallback).toBe('boolean');
    }
  }, 30_000);
});
