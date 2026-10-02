// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

// Boundaries only (AGENTS.md §4): the DB client (its real module imports `server-only`), the
// dailies service (the generation work this route guards), and the logger. The secret comparison —
// the route's whole job — runs for real.
vi.mock('@/lib/db/client', () => ({ db: {} }));
const generateDailyPuzzles = vi.fn();
vi.mock('@/features/dailies/dailies.service', () => ({
  generateDailyPuzzles: (...args: unknown[]) => generateDailyPuzzles(...args),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { GET } from './route';

const SECRET = 'correct-horse-battery-staple';

function buildRequest(authorization?: string): NextRequest {
  const headers = new Headers(authorization === undefined ? {} : { authorization });
  return { headers } as unknown as NextRequest;
}

describe('GET /api/cron/daily — the bearer secret is the only guard', () => {
  // A "never reached the service" assertion is vacuous without this (Docs/pre-merge-log.md).
  beforeEach(() => {
    generateDailyPuzzles.mockReset();
    generateDailyPuzzles.mockResolvedValue({ isoDate: '2026-10-02', requested: 8, inserted: 8, skipped: false });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('fails CLOSED (401) when CRON_SECRET is not configured — even for a request with no header', async () => {
    vi.stubEnv('CRON_SECRET', '');

    for (const auth of [undefined, 'Bearer ', 'Bearer undefined']) {
      const res = await GET(buildRequest(auth));
      expect(res.status).toBe(401);
    }
    expect(generateDailyPuzzles).not.toHaveBeenCalled();
  });

  it('rejects a wrong secret of the same length with 401', async () => {
    vi.stubEnv('CRON_SECRET', SECRET);
    const sameLength = 'x'.repeat(SECRET.length);

    const res = await GET(buildRequest(`Bearer ${sameLength}`));

    expect(res.status).toBe(401);
    expect(generateDailyPuzzles).not.toHaveBeenCalled();
  });

  it('rejects a wrong-length secret (shorter, longer, prefix) with 401 rather than throwing', async () => {
    vi.stubEnv('CRON_SECRET', SECRET);

    for (const auth of [`Bearer ${SECRET.slice(0, 4)}`, `Bearer ${SECRET}x`, 'Bearer', SECRET, '']) {
      const res = await GET(buildRequest(auth));
      expect(res.status).toBe(401);
    }
    expect(generateDailyPuzzles).not.toHaveBeenCalled();
  });

  it('runs the generation for today (UTC) with the correct secret', async () => {
    vi.stubEnv('CRON_SECRET', SECRET);

    const res = await GET(buildRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    expect(generateDailyPuzzles).toHaveBeenCalledTimes(1);
    expect(generateDailyPuzzles.mock.calls[0][1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await res.json()).toMatchObject({ ok: true, inserted: 8 });
  });

  it('answers a generation failure with a generic 500 — no message or stack on the wire', async () => {
    vi.stubEnv('CRON_SECRET', SECRET);
    generateDailyPuzzles.mockRejectedValue(new Error('relation "daily_puzzles" does not exist at /srv/x.ts:1'));

    const res = await GET(buildRequest(`Bearer ${SECRET}`));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toMatch(/relation|\.ts:/);
  });
});
