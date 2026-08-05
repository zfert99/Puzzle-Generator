// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db/connection';
import { solveAttempts, type DailyPuzzle } from '@/lib/db/schema';
import { recordSolve, SolveError } from './solve.service';

/**
 * The one-ranked-attempt-per-user invariant, under test at the point it is actually enforced.
 *
 * It used to be enforced only by a *read* (`attempt.completed`) followed by an unconditional
 * UPDATE — two round-trips with no transaction between them, since `neon-http` is stateless.
 * Two submissions racing each other both read `completed = false` and both wrote, so a
 * concurrent double-submit kept the better of two claimed times. The predicate now lives in
 * the UPDATE's own WHERE, which is atomic.
 */

const solution = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => ((r + c) % 9) + 1));

/**
 * A classic 9×9 `easy` daily — plausibility floor 15 s, so a 60 s solve passes cleanly.
 *
 * `grid` is the *dug* puzzle, not the solution: 41 givens and 40 blanks, matching what the cron
 * actually stores. That distinction is load-bearing for the mistake bound, which counts empty
 * cells — a fixture whose `grid` was the finished solution would report zero blanks and quietly
 * make every mistake count clamp to 0.
 */
const grid = solution.map((row, r) => row.map((value, c) => (r * 9 + c < 40 ? 0 : value)));
const puzzle = {
  id: 'puzzle-1',
  difficulty: 'easy',
  variant: 'classic',
  grid,
  solution,
} as unknown as DailyPuzzle;

/**
 * A DB stub covering both statements `recordSolve` issues: the ownership SELECT that finds the
 * user's attempt row, and the conditional UPDATE. `updateResult` is what the UPDATE's
 * `.returning()` yields — `[]` models "no row matched", i.e. someone else completed it first.
 */
function dbStub(options: { attempt: unknown; updateResult: unknown[] }) {
  const captured: { updateFilter: unknown; setValues: unknown } = { updateFilter: undefined, setValues: undefined };
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [options.attempt].filter(Boolean) }) }) }),
    update: () => ({
      set: (values: unknown) => {
        captured.setValues = values;
        return {
          where: (filter: unknown) => {
            captured.updateFilter = filter;
            return { returning: async () => options.updateResult };
          },
        };
      },
    }),
  } as unknown as Database;
  return { db, captured };
}

const args = { userId: 'user-A', puzzle, submittedGrid: solution, mistakes: 2, clientTimeMs: 60_000 };

describe('recordSolve — the conditional UPDATE', () => {
  it("carries `completed = false` in its WHERE, not just user + puzzle", async () => {
    const { db, captured } = dbStub({ attempt: { completed: false }, updateResult: [{ id: 'a1', timeMs: 60_000 }] });

    await recordSolve(db, args);

    // Compared against the exact expression, so dropping ANY of the three predicates fails —
    // an assertion that the filter is merely `toBeDefined()` would pass without the fix.
    expect(captured.updateFilter).toStrictEqual(
      and(
        eq(solveAttempts.userId, 'user-A'),
        eq(solveAttempts.puzzleId, 'puzzle-1'),
        eq(solveAttempts.completed, false),
      ),
    );
  });

  it('rejects the loser of a race instead of returning undefined', async () => {
    // The SELECT still sees an incomplete attempt (this request read first), but by the time
    // the UPDATE lands another request has completed it, so no row matches.
    const { db } = dbStub({ attempt: { completed: false }, updateResult: [] });

    await expect(recordSolve(db, args)).rejects.toThrow(SolveError);
    await expect(recordSolve(db, args)).rejects.toMatchObject({ code: 'ALREADY_COMPLETED', status: 409 });
    // Before the guard this resolved to `undefined`, and the route's `attempt.timeMs` then
    // threw a TypeError — a 500 where the caller should have seen a clean 409.
  });

  it('still rejects a plain sequential replay at the read', async () => {
    const { db } = dbStub({ attempt: { completed: true }, updateResult: [] });
    await expect(recordSolve(db, args)).rejects.toMatchObject({ code: 'ALREADY_COMPLETED', status: 409 });
  });

  it('rejects a submission with no recorded start', async () => {
    const { db } = dbStub({ attempt: null, updateResult: [] });
    await expect(recordSolve(db, args)).rejects.toMatchObject({ code: 'NOT_STARTED', status: 400 });
  });
});

describe('recordSolve — int4 column guards', () => {
  it('clamps a time that would overflow the integer column', async () => {
    const { db, captured } = dbStub({ attempt: { completed: false }, updateResult: [{ id: 'a1' }] });

    // Above int4's 2,147,483,647. It clears the plausibility floor (which only rejects times
    // that are too SMALL), so without a clamp it reached Postgres and errored mid-UPDATE.
    await recordSolve(db, { ...args, clientTimeMs: 1e12 });

    expect(captured.setValues).toMatchObject({ timeMs: 2_147_483_647 });
  });

  /**
   * Bounding by int4 alone kept the column safe while storing counts no board can produce: a probe
   * banked exactly 100 000 on a 4×4 daily, and the public leaderboard served it. The ceiling is now
   * what the board can distinctly produce — every empty cell wrong with every wrong digit.
   */
  it('bounds an absurd mistake count by what the BOARD can produce, not by the column', async () => {
    const { db, captured } = dbStub({ attempt: { completed: false }, updateResult: [{ id: 'a1' }] });

    await recordSolve(db, { ...args, mistakes: 9e15 });

    // 40 blanks × 8 wrong digits each = 320 distinct wrong placements this board admits.
    expect(captured.setValues).toMatchObject({ mistakes: 320 });
  });

  it('leaves a believable mistake count untouched', async () => {
    const { db, captured } = dbStub({ attempt: { completed: false }, updateResult: [{ id: 'a1' }] });
    await recordSolve(db, { ...args, mistakes: 7 });
    expect(captured.setValues).toMatchObject({ mistakes: 7 });
  });

  it('floors a fractional time (the column takes integers only)', async () => {
    const { db, captured } = dbStub({ attempt: { completed: false }, updateResult: [{ id: 'a1' }] });
    await recordSolve(db, { ...args, clientTimeMs: 60_000.7 });
    expect(captured.setValues).toMatchObject({ timeMs: 60_000 });
  });
});
