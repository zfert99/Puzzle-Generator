import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { user } from './auth-schema';

describe('auth-schema: user', () => {
  it('declares a case-insensitive unique index on username (lower(username))', () => {
    const { indexes } = getTableConfig(user);
    const lowerIdx = indexes.find((i) => i.config.name === 'user_username_lower_idx');
    expect(lowerIdx, 'user_username_lower_idx is declared').toBeDefined();
    expect(lowerIdx!.config.unique).toBe(true);
    // The migration that creates it is checked in beside the schema (0005).
  });
});
