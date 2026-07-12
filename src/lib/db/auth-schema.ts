import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * better-auth (1.6.x) identity tables — the canonical `user` plus its sessions, linked
 * accounts (OAuth/credential), verification tokens, and registered passkeys.
 *
 * These mirror exactly what better-auth's Drizzle adapter expects: the JS field keys are
 * the model field names in camelCase, so the adapter maps each field straight to a column
 * without a naming transform. Column-name strings match the keys for the same reason.
 *
 * `user.id` is a **string** (better-auth generates string ids), which is why
 * `solve_attempts.user_id` in [schema.ts](./schema.ts) is `text` and references
 * `user.id` here — not the uuid the 4.1 draft used. This `user` table replaces the
 * minimal custom `users` table from 4.1; auth now owns identity end-to-end.
 *
 * Do not query these directly from feature code — go through the better-auth API
 * (`src/features/auth/`). They live in the schema only so Drizzle and migrations know
 * their shape.
 */

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  // Public display handle for the leaderboard (so a full legal name isn't shown). Optional
  // until the user sets one; unique when present. Managed as a better-auth additionalField.
  username: text('username').unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

/** From the @better-auth/passkey plugin — one row per registered WebAuthn credential. */
export const passkey = pgTable('passkey', {
  id: text('id').primaryKey(),
  name: text('name'),
  publicKey: text('publicKey').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  credentialID: text('credentialID').notNull(),
  counter: integer('counter').notNull(),
  deviceType: text('deviceType').notNull(),
  backedUp: boolean('backedUp').notNull(),
  transports: text('transports'),
  createdAt: timestamp('createdAt').defaultNow(),
  aaguid: text('aaguid'),
});

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
