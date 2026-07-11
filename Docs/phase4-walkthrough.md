# Phase 4 Walkthrough — Dailies, Accounts & Leaderboards

> **Living document.** Updated as each slice lands. Companion to the plan in
> [phase4-implementation-plan.md](phase4-implementation-plan.md); this records what was
> *actually* built, the decisions taken, and how each piece was verified.

## Status at a glance

| Slice | Scope | Status |
| --- | --- | --- |
| 4.1 | Database layer (Neon + Drizzle) | ✅ Done, deployed |
| 4.2 | Daily puzzle cron + `/daily` | ✅ Done, deployed |
| 4.3 | Authentication & sessions (better-auth) | ✅ Verified locally; prod deploy pending |
| 4.3.1 | Authorization (BOLA) | 📋 Next |
| 4.4 | Leaderboards, streaks & anti-cheat | 📋 Planned |

**Confirmed stack:** Neon Postgres · Drizzle ORM · better-auth (passkeys-first) · Vercel
Cron · Upstash (4.4). **Daily rules:** anonymous play, 00:00 UTC rollover, difficulties
easy/medium/hard/expert (extreme excluded).

---

## 4.1 — Database layer

### What shipped

- `src/lib/db/schema.ts` — `daily_puzzles` and `solve_attempts` (the `users` table here was
  replaced by better-auth's `user` in 4.3 — see below).
- `src/lib/db/connection.ts` — unguarded `createDb(url)` factory over the Neon HTTP driver.
- `src/lib/db/client.ts` — the `server-only`-guarded app client (`db`) built on that factory.
- `src/lib/db/daily-row.ts` — pure, tested row mappers (`countClues`, `toDailyPuzzleRow`,
  `toUtcDateString`, `DAILY_DIFFICULTIES`).
- `src/lib/db/seed.ts` + `load-env.ts` — idempotent `db:seed`; `load-env` fixes ESM
  import-hoisting so `.env.local` is read before the client evaluates.
- Migration `0000_sloppy_bucky.sql`; scripts `db:generate` / `db:migrate` / `db:studio` /
  `db:seed`.

### Key decisions

- **Neon HTTP driver** (not a TCP pool): serverless functions can't hold a warm pool.
- **`server-only` guard split**: the guard lives on `client.ts`; scripts use the unguarded
  `createDb` factory (the guard throws under `tsx`, which is correct — it means the client
  can never reach the browser bundle).

**Verified:** migrated + seeded against real Neon; `tsc`/`eslint`/`markdownlint` clean;
unit tests for the pure mappers.

---

## 4.2 — Daily puzzle cron + `/daily`

### What shipped

- `src/features/dailies/dailies.service.ts` — `generateDailyPuzzles(db, isoDate)` (idempotent
  upsert) and `getDailyPuzzle(db, isoDate, difficulty)`. `db` is a **parameter**, so routes
  and the seed share it without tripping `server-only`.
- `src/app/api/cron/daily/route.ts` — Vercel Cron target, constant-time `CRON_SECRET` guard
  (SHA-256 + `timingSafeEqual`, fails closed if unset).
- `src/app/api/daily/route.ts` — `GET` today's puzzle; validates difficulty, 404s before the
  cron has run.
- `src/app/daily/page.tsx` + `src/features/dailies/components/DailyExperience.tsx` — reuse the
  whole Phase 3 board; local `select/playing` phase so a persisted `/play` game doesn't leak in.
- `vercel.json` — cron `/api/cron/daily` at `0 0 * * *`.

### Key decisions

- **Anti-cheat carve-out (revisit in 4.4):** `/api/daily` returns `solution` so the board can
  do local hint/mistake checking. Play is anonymous & unranked, so nothing is at stake yet.
  4.4 will stop serving it and validate solves server-side.

**Verified live on `puzzles.biscuitlab.net`:** `/api/daily` 200/400/404; cron 401 (no/wrong
secret) and idempotent 200 (with secret); `/daily` + `/play` SSR 200. Deployed to production
via `main`; cron confirmed registered + enabled through Vercel's API (`0 0 * * *`,
`disabledAt: null`). `CRON_SECRET` set in all Vercel environments.

---

## 4.3 — Authentication & sessions (better-auth)

### Decisions taken (this pass)

- Sign-in methods now: **Google OAuth + email/password bootstrap**, with **passkeys** layered
  on for returning logins. Scope: **backend wiring only** (no UI yet).
- Adopted **better-auth 1.6.23**. Passkey is a *separate* package (`@better-auth/passkey`) in
  this version — not bundled in core. Verified against installed types.

### What shipped

- `src/lib/db/auth-schema.ts` — better-auth's identity tables: `user`, `session`, `account`,
  `verification`, `passkey`. Field keys are camelCase so the adapter maps fields → columns
  directly.
- `src/features/auth/auth.ts` — the `betterAuth()` server instance: Drizzle adapter
  (`provider: "pg"`), **database sessions**, email/password with an **Argon2id** override,
  Google OAuth (registered only when its env creds exist), the passkey plugin, and
  `nextCookies()` last. `server-only`.
- `src/features/auth/password.ts` — Argon2id hash/verify at the OWASP baseline (m=19456, t=2,
  p=1) via `@node-rs/argon2`. Isolated + unit-tested.
- `src/features/auth/session.ts` — `getSession()` / `getCurrentUserId()`; the single identity
  accessor the 4.3.1 BOLA checks and 4.4 solve submission will build on.
- `src/app/api/auth/[...all]/route.ts` — better-auth's catch-all handler (`toNextJsHandler`),
  `runtime = "nodejs"`.

### Schema reconciliation (important)

better-auth's `user.id` is a **string**, but 4.1's `users.id` was a uuid. Resolution: drop the
minimal custom `users` table, adopt better-auth's `user` as canonical, and change
`solve_attempts.user_id` from `uuid` → `text` referencing `user.id`. Both `users` and
`solve_attempts` were empty (only `daily_puzzles` is populated), so migration `0001_auth_tables`
safely drops and recreates them. The migration was **hand-authored** (drizzle-kit's rename-vs-
create resolver needs a TTY); its snapshot was produced from a full-schema generation and
chained onto `0000`, verified by a follow-up `db:generate` reporting *no changes*.

### Key decisions

- **Passkeys-first** per AGENTS.md §6; email/password only as a bootstrap, and when a password
  is stored it is **Argon2id** (better-auth's default scrypt is overridden).
- **Google registered conditionally** on env creds so a missing OAuth app never breaks
  build/startup — email/password + passkeys still work without it.
- **DB sessions**, `HttpOnly`/`Secure`/`SameSite=Lax` cookies (better-auth defaults); no tokens
  in web storage.
- **Neon HTTP has no transactions** — the Drizzle adapter's `transaction` option is left unset
  (defaults off); do not enable it on this driver.

**Verified end-to-end** against real Neon (`tsc`/`eslint`/`build`/markdownlint clean; 104 tests):

- Migration `0001_auth_tables` applied — all 7 tables present, old `users` gone,
  `solve_attempts.user_id` is `text`, the 4 daily puzzles preserved.
- Email/password: sign-up 200 (string id, session cookie); sign-in 200 (Argon2id **verify**);
  wrong password 401; `account.password` stored as `$argon2id$…`.
- Sessions: `get-session` returns a 7-day DB session; sign-out 403 without `Origin`, 200 with
  (better-auth CSRF guard).
- Passkey: `GET /passkey/generate-register-options` returns a WebAuthn challenge
  (`rp.id: localhost`, `rp.name: Puzzle Generator`).
- Google OAuth: `sign-in/social` returns a valid Google auth URL with the right
  `redirect_uri`, `scope=email profile openid`, `state`, and **PKCE** (`code_challenge`,
  `S256`). The interactive browser login is the one step not machine-verifiable.
- The test user created during verification was deleted (cascade) — prod DB left clean.

**Pending (deploy):** the auth code is **not yet on production**. Before it deploys, set in
Vercel env: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://puzzles.biscuitlab.net`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (and the prod Google redirect URI is already
registered).

**New env vars:** `BETTER_AUTH_SECRET` (required), `BETTER_AUTH_URL`, optional
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. See `.env.example`.

---

## Cross-cutting notes

- **Dev-only audit advisory:** `drizzle-kit` pulls a transitive esbuild dev-server advisory
  (moderate). Dev tooling only — `npm audit --omit=dev` is clean.
- **Secrets:** `.env.local` (git-ignored) holds local dev secrets; production secrets live in
  Vercel env. Rotate any credential pasted in plaintext during setup.
