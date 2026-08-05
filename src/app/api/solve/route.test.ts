// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Only the auth + daily-lookup boundary needs mocking: `requireUserId` so the route doesn't
// need a real session, and `getDailyPuzzle` returning null so the flow reaches a clean 404
// without touching a real DB. Anything past that (recordSolve/getUserRank) never runs here.
// `@/lib/db/client` is stubbed too — its real module imports `server-only`, which throws
// outside Next's own build; `db` is never actually used since `getDailyPuzzle` is mocked.
vi.mock('@/lib/db/client', () => ({ db: {} }));
vi.mock('@/features/auth/session', () => ({
  requireUserId: vi.fn(async () => 'test-user-id'),
}));
vi.mock('@/features/dailies/dailies.service', () => ({
  getDailyPuzzle: vi.fn(async () => null),
}));

import { POST } from './route';

function buildRequest(body: Record<string, unknown>): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

/** A fully-filled, shape-valid `size x size` grid (values aren't a real solution — the
 * grid-shape check runs before solution verification, which never executes in these tests
 * since `getDailyPuzzle` is mocked to return null). */
const fullGrid = (size: number): number[][] =>
  Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => ((r + c) % size) + 1));

/**
 * Regression coverage for a real production bug: `isCompletedGrid` used to hardcode a 9×9
 * shape, so every mini daily (4×4/6×6) solve was rejected with a 400 before ever reaching
 * `recordSolve` — the client's local win-detection still showed "Daily Solved!", but nothing
 * was recorded, so it never appeared on the leaderboard or the dailies "completed" list.
 */
describe('POST /api/solve — grid-size validation', () => {
  it('passes shape validation for a completed 4x4 mini grid', async () => {
    const res = await POST(buildRequest({ difficulty: 'mini-easy', grid: fullGrid(4), timeMs: 60_000 }));
    // getDailyPuzzle is mocked to null -> 404 "no daily puzzle for ...". Getting here (rather
    // than the old 400) proves the grid-shape check itself accepted the 4x4 board.
    expect(res.status).toBe(404);
  });

  it('passes shape validation for a completed 6x6 mini grid', async () => {
    const res = await POST(buildRequest({ difficulty: 'mini-hard', grid: fullGrid(6), timeMs: 60_000 }));
    expect(res.status).toBe(404);
  });

  it('still accepts a retired key so archived boards stay replayable', async () => {
    const res = await POST(buildRequest({ difficulty: 'mini4-easy', grid: fullGrid(4), timeMs: 60_000 }));
    expect(res.status).toBe(404); // reached the lookup, i.e. the key validated
  });

  it('still passes shape validation for a completed 9x9 classic grid', async () => {
    const res = await POST(buildRequest({ difficulty: 'easy', grid: fullGrid(9), timeMs: 60_000 }));
    expect(res.status).toBe(404);
  });

  it('rejects digits outside a 4x4 grid\'s own 1-4 range', async () => {
    const badGrid = fullGrid(4).map((row) => row.map((v) => v + 9)); // 10-13, invalid for size 4
    const res = await POST(buildRequest({ difficulty: 'mini-easy', grid: badGrid, timeMs: 60_000 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/4x4/i);
  });

  it('rejects an unsupported grid size (e.g. 5x5)', async () => {
    const res = await POST(buildRequest({ difficulty: 'easy', grid: fullGrid(5), timeMs: 60_000 }));
    expect(res.status).toBe(400);
  });

  it('rejects a missing grid', async () => {
    const res = await POST(buildRequest({ difficulty: 'easy', timeMs: 60_000 }));
    expect(res.status).toBe(400);
  });
});

/**
 * `time_ms` is a Postgres `integer`. A submitted value above int4 used to pass every check
 * here — the plausibility floor only rejects times that are too *small* — then fail at the
 * driver mid-UPDATE as "value out of range for type integer", so an input the route had
 * already accepted came back as an unhandled 500 with a stack in the logs.
 */
describe('POST /api/solve — timeMs bounds', () => {
  const submit = (timeMs: unknown) => POST(buildRequest({ difficulty: 'easy', grid: fullGrid(9), timeMs }));

  it('rejects a time larger than the int4 column can hold', async () => {
    expect((await submit(1e12)).status).toBe(400);
  });

  it('rejects a time beyond the 24h ceiling', async () => {
    expect((await submit(24 * 60 * 60 * 1000 + 1)).status).toBe(400);
  });

  it('accepts a time exactly at the ceiling', async () => {
    // 404 (not 400) = it cleared validation and reached the mocked daily lookup.
    expect((await submit(24 * 60 * 60 * 1000)).status).toBe(404);
  });

  it('still rejects a negative time', async () => {
    expect((await submit(-1)).status).toBe(400);
  });

  it('accepts an ordinary solve time', async () => {
    expect((await submit(600_000)).status).toBe(404);
  });
});

describe('POST /api/solve — mistakes is clamped, never fatal', () => {
  // Cosmetic (it never affects ranking), so an absurd count must not fail an otherwise-valid
  // solve — but it shares the int4 column, so it cannot be passed through raw either.
  it.each([9e15, -5, 1.7])('accepts a solve with an out-of-range mistake count of %p', async (mistakes) => {
    const res = await POST(buildRequest({ difficulty: 'easy', grid: fullGrid(9), timeMs: 60_000, mistakes }));
    expect(res.status).toBe(404); // reached the lookup — not rejected on `mistakes`
  });
});
