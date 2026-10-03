# Auth Schema (`auth-schema.ts`)

better-auth's identity tables, expressed in Drizzle: `user`, `session`, `account`,
`verification`, and `passkey`.

## Why these live in their own file (and why hand-written)

**Why:** They are owned conceptually by better-auth, not the app domain, so keeping them
separate from `schema.ts` keeps the boundary clear. They are hand-written (rather than
CLI-generated) to match better-auth 1.6.x exactly: **the JS field keys are the model field
names in camelCase**, so the Drizzle adapter maps each field straight to a column with no
naming transform. Column-name strings equal the keys for the same reason.

## Why `user.id` is a string (and the ripple)

**Why:** better-auth generates **string** ids, not uuids. That is the single most important
fact for reconciliation: `solve_attempts.user_id` (in `schema.ts`) is therefore `text` and
references `user.id` here. This `user` table **replaces** the minimal custom `users` table
from 4.1 — auth now owns identity end-to-end.

```text
user         id(text PK), name, email(unique), emailVerified, image, createdAt, updatedAt
session      id(text PK), userId->user(cascade), token(unique), expiresAt, ip, ua, timestamps
account      id(text PK), userId->user(cascade), accountId, providerId, tokens…, password, ts
verification id(text PK), identifier, value, expiresAt, timestamps
passkey      id(text PK), userId->user(cascade), publicKey, credentialID, counter, backedUp…
```

## `user.username`

**Why:** A public leaderboard handle so a full account name (e.g. a Google real name) isn't
shown. Nullable until the user picks one; unique when set. It's a better-auth
*additionalField* (see [auth.ts](../../features/auth/auth.md)), settable via `updateUser`;
the leaderboard shows `username`, else the neutral `'Player'` — never `name`, which for an email sign-up is the email's local part and for Google the legal name (October 2026); Puzzle Bot is labelled from `BOT_NAME` by id.

**Case-insensitive uniqueness (October 2026):** the column's `UNIQUE` is case-sensitive, so
`Alice` and `alice` could coexist — two leaderboard handles a reader cannot tell apart, the
impersonation hole next to the one the username validator closed. Migration `0005` adds a
functional unique index, `user_username_lower_idx` on `lower(username)`. The second spelling now
fails with a unique-violation, which `UsernamePrompt`/`AccountBadge` already report as "that
username is taken" (they match on `unique` in the error). Additive and reversible (`DROP INDEX`);
the live table held six users and no case-duplicates when it was generated. Applied with
`npm run db:migrate` under the owner's unpooled connection, like every migration here.

## Note

Do not query these tables directly from feature code — go through the better-auth API in
`src/features/auth/`. They exist in the schema only so Drizzle and migrations know their
shape (and so `solve_attempts` can reference `user`).
