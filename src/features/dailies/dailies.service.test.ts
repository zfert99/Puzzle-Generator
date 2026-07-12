import { describe, expect, it, vi } from 'vitest';
import type { Database } from '@/lib/db/connection';
import { generateDailyPuzzles, getDailyPuzzle } from './dailies.service';
import { DAILY_DIFFICULTIES } from '@/lib/db/daily-row';

/**
 * The DB is mocked at the boundary (a stand-in Drizzle client), never by mocking
 * internal modules — the engine, row mapping, and service orchestration all run for
 * real. We assert the service builds the right rows and returns accurate counts.
 */

describe('generateDailyPuzzles', () => {
  it('generates one row per daily difficulty and upserts idempotently', async () => {
    const values = vi.fn();
    // Simulate a first run: every row is newly inserted.
    const returning = vi.fn(async () => DAILY_DIFFICULTIES.map((_, i) => ({ id: `id-${i}` })));
    const onConflictDoNothing = vi.fn(() => ({ returning }));
    values.mockReturnValue({ onConflictDoNothing });
    const insert = vi.fn(() => ({ values }));
    const db = { insert } as unknown as Database;

    const result = await generateDailyPuzzles(db, '2026-07-11');

    expect(result).toEqual({
      isoDate: '2026-07-11',
      requested: DAILY_DIFFICULTIES.length,
      inserted: DAILY_DIFFICULTIES.length,
    });

    // One insert of exactly the daily difficulties, all dated for the given day.
    const rows = values.mock.calls[0][0];
    expect(rows).toHaveLength(DAILY_DIFFICULTIES.length);
    expect(rows.map((r: { difficulty: string }) => r.difficulty)).toEqual([...DAILY_DIFFICULTIES]);
    expect(rows.every((r: { date: string }) => r.date === '2026-07-11')).toBe(true);
    expect(rows.every((r: { clueCount: number }) => r.clueCount > 16 && r.clueCount < 81)).toBe(true);
    // Generates a real puzzle per difficulty, incl. the slow Extreme digger — allow headroom.
  }, 30_000);

  it('reports 0 inserted when today already exists (conflict)', async () => {
    const returning = vi.fn(async () => []); // conflict: nothing inserted
    const db = {
      insert: () => ({ values: () => ({ onConflictDoNothing: () => ({ returning }) }) }),
    } as unknown as Database;

    const result = await generateDailyPuzzles(db, '2026-07-11');
    expect(result.inserted).toBe(0);
    expect(result.requested).toBe(DAILY_DIFFICULTIES.length);
  }, 30_000);
});

describe('getDailyPuzzle', () => {
  it('returns the row for a matching date + difficulty', async () => {
    const row = { id: 'p1', date: '2026-07-11', difficulty: 'medium' };
    const limit = vi.fn(async () => [row]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const db = { select: () => ({ from }) } as unknown as Database;

    const result = await getDailyPuzzle(db, '2026-07-11', 'medium');
    expect(result).toBe(row);
  });

  it('returns null when no puzzle exists for that day', async () => {
    const db = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    } as unknown as Database;

    const result = await getDailyPuzzle(db, '2026-07-11', 'expert');
    expect(result).toBeNull();
  });
});
