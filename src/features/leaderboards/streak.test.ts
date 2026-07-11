import { describe, expect, it } from 'vitest';
import { currentStreak } from './streak';

const TODAY = '2026-07-11';

describe('currentStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(currentStreak(['2026-07-11', '2026-07-10', '2026-07-09'], TODAY)).toBe(3);
  });

  it('grace: a streak ending yesterday still counts (today not done yet)', () => {
    expect(currentStreak(['2026-07-10', '2026-07-09'], TODAY)).toBe(2);
  });

  it('is 0 when neither today nor yesterday was completed', () => {
    expect(currentStreak(['2026-07-08', '2026-07-07'], TODAY)).toBe(0);
  });

  it('stops at the first gap', () => {
    // today, yesterday, then a gap (skips the 9th) — streak is just the 2 recent days.
    expect(currentStreak(['2026-07-11', '2026-07-10', '2026-07-08'], TODAY)).toBe(2);
  });

  it('handles duplicates and unsorted input', () => {
    expect(currentStreak(['2026-07-10', '2026-07-11', '2026-07-11', '2026-07-09'], TODAY)).toBe(3);
  });

  it('is 0 for no completions', () => {
    expect(currentStreak([], TODAY)).toBe(0);
  });

  it('crosses a month boundary correctly', () => {
    expect(currentStreak(['2026-07-01', '2026-06-30', '2026-06-29'], '2026-07-01')).toBe(3);
  });
});
