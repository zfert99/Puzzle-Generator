import { describe, expect, it, vi } from 'vitest';
import type { Database } from '@/lib/db/connection';
import { user } from '@/lib/db/auth-schema';
import { ensureBotUser, BOT_USER_ID, BOT_NAME } from './bot';

describe('ensureBotUser', () => {
  it('upserts the bot user row with the reserved id, idempotently (onConflictDoNothing)', async () => {
    const onConflictDoNothing = vi.fn(async () => undefined);
    const values = vi.fn<(row: Record<string, unknown>) => { onConflictDoNothing: typeof onConflictDoNothing }>(
      () => ({ onConflictDoNothing }),
    );
    const insert = vi.fn(() => ({ values }));
    const db = { insert } as unknown as Database;

    await ensureBotUser(db);

    expect(insert).toHaveBeenCalledWith(user);
    const row = values.mock.calls[0][0];
    expect(row).toMatchObject({ id: BOT_USER_ID, name: BOT_NAME, emailVerified: true });
    expect(typeof row.email).toBe('string');
    expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
  });

  it('is safe to call twice — the second call is just another no-op conflict', async () => {
    const onConflictDoNothing = vi.fn(async () => undefined);
    const values = vi.fn(() => ({ onConflictDoNothing }));
    const insert = vi.fn(() => ({ values }));
    const db = { insert } as unknown as Database;

    await ensureBotUser(db);
    await ensureBotUser(db);

    expect(insert).toHaveBeenCalledTimes(2);
    expect(onConflictDoNothing).toHaveBeenCalledTimes(2);
  });
});
