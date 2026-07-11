# Phase 4: Dailies, Accounts & Leaderboards

## Context

Phases 1–3 kept the app **stateless**: it generates puzzles and forgets. Phase 4 is
the architectural pivot to **stateful** — introducing a database, user accounts, one
shared daily puzzle per difficulty, and solve-time leaderboards with streaks. This is
the phase with the largest new attack surface (auth, personal data, writes), so it is
planned security-first against AGENTS.md Section 6 and
[web-security-mitigation.md](research/web-security-mitigation.md).

It builds directly on the Phase 3 interactive board: the daily puzzle loads into the
existing `useBoardStore`, and completing it records a verified solve time.

## Scope & Delivery Order

Ship in independently-mergeable slices — each is useful on its own:

1. **4.1 Database layer** — provider, ORM, schema, migrations, seed.
2. **4.2 Daily puzzle cron** — generate one puzzle per difficulty per day; a `/daily`
   route that loads it into the board (no auth yet — playable anonymously).
3. **4.3 Authentication & sessions** — passkeys-first + OAuth; secure session cookies.
4. **4.3.1 Authorization (BOLA)** — ownership checks at the data-access layer.
5. **4.4 Leaderboards & streaks** — record verified solves, per-day boards, personal
   bests, streaks, and the UI.

## Decisions to Confirm (recommendations, your call)

These shape everything below. The plan proceeds with the **recommended** option; say
the word to switch.

| Decision | Recommended | Alternatives / trade-offs |
| --- | --- | --- |
| **Database** | **Postgres on Neon** (Vercel Postgres) — tightest Vercel integration, serverless driver, generous free tier | **Supabase** (Postgres + built-in auth/storage; heavier but batteries-included). See [portfolio-hosting.md](research/portfolio-hosting.md). |
| **ORM** | **Drizzle** — lightweight, SQL-first, type-safe, serverless/edge-friendly, parameterized by default | **Prisma** — more mature, richer tooling, heavier bundle/cold start. Both satisfy the "type-safe ORM, parameterized queries" rule. |
| **Auth** | **Auth.js (NextAuth v5)** with a Drizzle adapter, OAuth (Google/GitHub) **and** a Passkey/WebAuthn provider (SimpleWebAuthn under the hood) | Roll-your-own with SimpleWebAuthn + Lucia. Auth.js is less code and battle-tested. |
| **Cron** | **Vercel Cron** (`vercel.json`) hitting a secret-guarded route | Supabase scheduled functions / external scheduler. |

> Passkeys-first (AGENTS.md Section 6): offer passkey sign-in as the **primary**
> option with OAuth as fallback — not passwords. If local email/password is ever
> added, hash with **Argon2id** (baseline m=19456/t=2/p=1) + a 16-byte salt.

## Architecture

New feature modules, keeping domains separate (Section 1):

```text
src/lib/db.ts                      # ORM client + connection (server-only)
src/features/dailies/             # daily puzzle service, /daily UI glue
src/features/auth/                # Auth.js config, session helpers, passkey flow
src/features/leaderboards/        # solve submission + leaderboard queries/UI
src/app/api/daily/route.ts        # GET today's puzzle
src/app/api/solve/route.ts        # POST a solve attempt (server-validated)
src/app/api/leaderboard/route.ts  # GET a day's leaderboard
src/app/api/cron/daily/route.ts   # Vercel Cron target (secret-guarded)
src/app/(auth)/…                   # Auth.js route handlers
src/app/daily/page.tsx            # daily play route (Server shell -> client board)
src/app/leaderboard/page.tsx      # leaderboard route
```

All API routes stay thin **controllers** that validate input and delegate to feature
**services**; DB access lives only in services (Section 1). Routes touching Node
modules declare `export const runtime = 'nodejs'`.

### Data model (`src/lib/db/schema.ts`)

Adapted from the roadmap. Parameterized access only, via the ORM.

```sql
-- One shared puzzle per difficulty per day.
CREATE TABLE daily_puzzles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL,
  difficulty  TEXT NOT NULL,            -- easy|medium|hard|expert
  grid        JSONB NOT NULL,           -- unsolved puzzle
  solution    JSONB NOT NULL,           -- solved grid (server-only; never sent raw)
  clue_count  INT  NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (date, difficulty)
);

CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username    TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
  -- auth identities (OAuth accounts, passkeys, sessions) live in Auth.js's
  -- adapter tables; no local password column unless password auth is added
  -- (then: password_hash via Argon2id).
);

CREATE TABLE solve_attempts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  puzzle_id   UUID NOT NULL REFERENCES daily_puzzles(id) ON DELETE CASCADE,
  time_ms     INT  NOT NULL,           -- server-computed solve duration
  completed   BOOLEAN DEFAULT false,
  mistakes    INT  DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, puzzle_id)          -- one ranked attempt per user per puzzle
);

CREATE INDEX ON solve_attempts (puzzle_id, time_ms);  -- leaderboard ordering
```

The `solution` column is **never** returned to the client for an unsolved daily — the
client validates locally only after the server confirms completion (see anti-cheat).

### 4.2 Daily puzzle cron

- `src/app/api/cron/daily/route.ts` — guarded by a `CRON_SECRET` (compared in
  constant time); rejects anything else with 401. `runtime = 'nodejs'`.
- Runs at 00:00 UTC (via `vercel.json` `crons`). For each difficulty, calls the engine
  (`generateSudoku`) and upserts a row into `daily_puzzles` for today (idempotent via
  the `UNIQUE(date, difficulty)` constraint — safe to re-run).
- `src/app/daily/page.tsx` — Server shell → client component that `GET`s
  `/api/daily?difficulty=…` and hands the grid to `useBoardStore.startNewGame`.
  Reuses the whole Phase 3 board.

### 4.3 Authentication & sessions

- Auth.js (NextAuth v5) with the Drizzle adapter and **database sessions**.
- **Passkeys-first**: a WebAuthn/passkey provider as the primary sign-in, OAuth
  (Google/GitHub) as fallback. Session cookies are `HttpOnly`, `Secure`,
  `SameSite=Lax` (or `Strict` where UX allows) — no tokens in `localStorage`.
- If JWT sessions are chosen instead of DB sessions, apply the **Hybrid Token
  Architecture**: short-lived access token in memory, long-lived refresh token in an
  `HttpOnly`/`Secure`/`SameSite` cookie, with rotation. Enforce **PKCE** on OAuth.
- Server-side `getSession()` helper in `src/features/auth/` for use in route handlers.

### 4.3.1 Authorization (BOLA) — the highest-risk item

AGENTS.md flags this as the #1 AI pitfall: verifying *authentication* but not
*ownership*. Every route that reads or mutates a user's record must verify ownership
at the data-access layer:

- `/api/solve` writes a `solve_attempt` for **`session.userId`** — never a client-
  supplied `userId`.
- Any "my attempts / my stats" read filters by `WHERE user_id = session.userId`.
- Deletes/updates re-check ownership in the same query (strict `WHERE`), not in app
  code after a fetch.
- Centralize this in the leaderboard/solve services so no route can forget it.

### 4.4 Leaderboards, streaks & anti-cheat

- **Solve submission** (`POST /api/solve`): the client sends the puzzle id and its
  **start timestamp** (issued by the server when the daily was fetched); the server
  computes `time_ms` from its own clock and validates the completed grid against the
  stored `solution`. **Never trust a client-reported solve time.** Reject implausible
  times (too fast for the difficulty). One ranked attempt per user per puzzle
  (`UNIQUE(user_id, puzzle_id)`).
- **Leaderboard** (`GET /api/leaderboard?date=…&difficulty=…`): top N by `time_ms`
  via the `(puzzle_id, time_ms)` index; plus the caller's own rank.
- **Streaks**: consecutive-day completions, computed from `solve_attempts` (a query or
  a maintained counter).
- **UI**: `src/app/leaderboard/page.tsx` — daily board per difficulty, personal bests,
  streak, animated rank reveal after completing a daily.

## Security Checklist (AGENTS.md Section 6 — CRITICAL)

- [ ] **Parameterized queries only** via the ORM; no string-built SQL.
- [ ] **BOLA/ownership checks** at the data-access layer on every personal record.
- [ ] **Least privilege** DB role (no `DROP`/DDL at runtime; migrations run separately).
- [ ] **Passkeys-first**; **Argon2id** + 16-byte salt only if local passwords appear.
- [ ] **Sessions**: `HttpOnly`/`Secure`/`SameSite` cookies; no tokens in web storage;
      refresh-token rotation + PKCE if using JWTs.
- [ ] **Anti-cheat**: server-side time validation; grid verified against stored solution.
- [ ] **Rate limiting** on auth + `/api/solve` (Upstash/Vercel KV or middleware).
- [ ] **Secrets** in env only (`DATABASE_URL`, auth secrets, `CRON_SECRET`); never
      committed, never shipped to the client.
- [ ] **Input validation** on every route (reuse the existing validate-then-500-generic
      pattern; no stack traces to clients).
- [ ] CI already runs CodeQL + Dependabot + `npm audit`; keep them green.

## Testing & Verification

- **Vitest (services/logic)** — daily generation/upsert, solve validation (rejects
  wrong grids and implausible times), streak computation, ownership filters. Mock the
  DB at the boundary (a repository interface or a test database), never internal modules.
- **Playwright (E2E)** — sign in (test provider), load the daily, solve it, see it on
  the leaderboard; and a BOLA negative test (user A cannot read/write user B's data).
- **Migrations** — `drizzle-kit`/`prisma migrate` checked into `src/lib/db/migrations`;
  a seed script for a local daily puzzle.
- **Build** — `next build` must stay clean; new API routes are dynamic (`ƒ`).
- **Env** — document required vars in `.env.example`.

## Open Questions

- **DB provider / ORM / auth** — confirm the three recommendations above.
- **Anonymous play**: allow solving the daily without an account (results just not
  ranked)? Recommended yes — lowers the barrier.
- **Difficulties for dailies**: easy/medium/hard/expert (skip extreme for a daily, or
  include it)?
- **Time zone**: daily rollover at 00:00 UTC for everyone (recommended) vs local.

## Not in Scope (defer)

Real-time multiplayer races, mobile app, and community puzzle sharing remain post-Phase-5
"future horizons." Phase 3 polish (subgrid, sound, etc.) is tracked separately in the
roadmap.
