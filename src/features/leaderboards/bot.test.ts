import { describe, expect, it, vi } from 'vitest';
import type { Database } from '@/lib/db/connection';
import { user } from '@/lib/db/auth-schema';
import { ensureBotUser, BOT_USER_ID, BOT_NAME } from './bot';

type OnConflict = (arg: { target: unknown; set: Record<string, unknown> }) => Promise<undefined>;

function makeDb() {
  const onConflictDoUpdate = vi.fn<OnConflict>(async () => undefined);
  const values = vi.fn<(row: Record<string, unknown>) => { onConflictDoUpdate: typeof onConflictDoUpdate }>(
    () => ({ onConflictDoUpdate }),
  );
  const insert = vi.fn(() => ({ values }));
  return { db: { insert } as unknown as Database, insert, values, onConflictDoUpdate };
}

describe('ensureBotUser', () => {
  it('upserts the bot user row under the reserved id', async () => {
    const { db, insert, values, onConflictDoUpdate } = makeDb();

    await ensureBotUser(db);

    expect(insert).toHaveBeenCalledWith(user);
    const row = values.mock.calls[0][0];
    expect(row).toMatchObject({ id: BOT_USER_ID, name: BOT_NAME, emailVerified: true });
    expect(typeof row.email).toBe('string');
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });

  /**
   * Regression: this was `onConflictDoNothing`, which creates the row once and then never touches
   * it again — so renaming the bot changed the constant but left the OLD display name in the
   * database forever. The conflict path must refresh the display fields.
   */
  it('refreshes the display name on conflict, so a rename actually reaches the database', async () => {
    const { db, onConflictDoUpdate } = makeDb();

    await ensureBotUser(db);

    const arg = onConflictDoUpdate.mock.calls[0][0];
    expect(arg.set).toMatchObject({ name: BOT_NAME });
    expect(arg.target).toBe(user.id);
  });

  /** The id is the FK target for every historical bot solve — the upsert must never rewrite it. */
  it('never writes the id on the conflict path', async () => {
    const { db, onConflictDoUpdate } = makeDb();

    await ensureBotUser(db);

    expect(onConflictDoUpdate.mock.calls[0][0].set).not.toHaveProperty('id');
  });

  it('is safe to call twice', async () => {
    const { db, insert, onConflictDoUpdate } = makeDb();

    await ensureBotUser(db);
    await ensureBotUser(db);

    expect(insert).toHaveBeenCalledTimes(2);
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(2);
  });
});
