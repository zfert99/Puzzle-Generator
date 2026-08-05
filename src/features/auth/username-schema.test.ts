// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { usernameSchema } from './username-schema';
import { USERNAME_RULE } from './username';

/**
 * The username rule used to live ONLY in two `'use client'` components, so a direct
 * `POST /api/auth/update-user` bypassed it entirely and any string landed in an unbounded
 * `text` column that renders on the public leaderboard. These assert the server-side control
 * that closed it — and, critically, the Standard Schema contract better-auth needs from it.
 */

/** How better-auth actually invokes the validator (`parseInputData` in its `db/schema`). */
const validate = (value: unknown) => usernameSchema['~standard'].validate(value);

describe('usernameSchema — the Standard Schema contract better-auth relies on', () => {
  it('validates SYNCHRONOUSLY', () => {
    // better-auth throws INTERNAL_SERVER_ERROR rather than a 400 if the result is a Promise,
    // which would turn every rejected username into a 500. Non-negotiable.
    expect(validate('good_name')).not.toBeInstanceOf(Promise);
  });

  it('reports failures as `issues` carrying the shared rule text', () => {
    const result = validate('aa');
    // better-auth surfaces `issues[0].message` as the 400 body, so this is the string the
    // user sees — it must be the same phrasing the client-side hint shows.
    expect(result).toHaveProperty('issues');
    expect((result as { issues: { message: string }[] }).issues[0].message).toBe(USERNAME_RULE);
  });
});

describe('usernameSchema — what it accepts', () => {
  it.each(['abc', 'sudoku_ace', 'a-b_9', 'A'.repeat(20)])('accepts %j', (value) => {
    expect(validate(value)).toEqual({ value });
  });
});

describe('usernameSchema — the abuse cases the client-only check let through', () => {
  it.each([
    ['a 10,000-char handle that would break the leaderboard layout', 'a'.repeat(10_000)],
    ['21 chars — one over the limit', 'a'.repeat(21)],
    ['2 chars — one under the limit', 'aa'],
    ['empty', ''],
    ['a bidi override that reverses surrounding text', 'ab‮cd'],
    ['a zero-width joiner', 'ab‍cd'],
    ['whitespace padding', '  spaced  '],
    ['a newline', 'ab\ncd'],
    ['"Puzzle Bot" — impersonating the system account', 'Puzzle Bot'],
    ['HTML-ish markup', '<img src=x>'],
  ])('rejects %s', (_label, value) => {
    expect(validate(value)).toHaveProperty('issues');
  });

  it('rejects a non-string outright', () => {
    expect(validate(12345)).toHaveProperty('issues');
  });
});
