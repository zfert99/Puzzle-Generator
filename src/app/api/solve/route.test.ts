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
    const res = await POST(buildRequest({ difficulty: 'mini4-easy', grid: fullGrid(4), timeMs: 60_000 }));
    // getDailyPuzzle is mocked to null -> 404 "no daily puzzle for ...". Getting here (rather
    // than the old 400) proves the grid-shape check itself accepted the 4x4 board.
    expect(res.status).toBe(404);
  });

  it('passes shape validation for a completed 6x6 mini grid', async () => {
    const res = await POST(buildRequest({ difficulty: 'mini6-easy', grid: fullGrid(6), timeMs: 60_000 }));
    expect(res.status).toBe(404);
  });

  it('still passes shape validation for a completed 9x9 classic grid', async () => {
    const res = await POST(buildRequest({ difficulty: 'easy', grid: fullGrid(9), timeMs: 60_000 }));
    expect(res.status).toBe(404);
  });

  it('rejects digits outside a 4x4 grid\'s own 1-4 range', async () => {
    const badGrid = fullGrid(4).map((row) => row.map((v) => v + 9)); // 10-13, invalid for size 4
    const res = await POST(buildRequest({ difficulty: 'mini4-easy', grid: badGrid, timeMs: 60_000 }));
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
