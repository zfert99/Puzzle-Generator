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
the leaderboard coalesces `username → name`.

## Note

Do not query these tables directly from feature code — go through the better-auth API in
`src/features/auth/`. They exist in the schema only so Drizzle and migrations know their
shape (and so `solve_attempts` can reference `user`).
