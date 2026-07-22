# Sudoku Bot (`bot.ts` + `bot-identity.ts`)

A transparent, clearly-labeled system account that posts a good-but-beatable time on every
daily board — a visible "time to beat" while the real player base is small.

## Why a bot account instead of a fabricated time on a real user

**Why:** Server-computed solve timing and one real attempt per user per puzzle are the
anti-cheat guarantees the leaderboard is built on — a client-reported time is never trusted,
and a real account's row is expected to represent a real, unassisted attempt. Posting a
time under any real player's account (even the developer's own) would be leaderboard fraud
against that guarantee, and would contradict the social/economy design principle that
currency and rank are earned from play, never fabricated. A separate, obviously-bot account
sidesteps both problems: it never claims to be a person, and the UI always says so.

**Why it can never be "played":** The bot has a `user` row (so the leaderboard join works)
but no `account`/`session`/passkey row — nothing in the auth flow can sign in as it. Its
only footprint is that `user` row and its `solve_attempts` rows, both written server-side by
the trusted daily-generation pipeline, never through the client-facing solve-submission
endpoint.

## Why split `bot-identity.ts` out from `bot.ts`

**Why:** `bot.ts` does real DB writes and imports the live Drizzle `user` table — bundling
that into a client component would leak server/DB code into the client bundle (App Router
Purity; see the performance-audit doc's guidance against client-bundle bloat). The
leaderboard UI only needs the bot's id to render its badge, so that id (and its display name)
lives in a zero-dependency module client code can import safely, and `bot.ts` re-exports it
for server-side callers' convenience.

```text
bot-identity.ts: BOT_USER_ID, BOT_NAME  — plain string constants, no imports
bot.ts:          imports bot-identity.ts + the real `user` table, does the DB write
```

## `ensureBotUser(db)`

**Why idempotent-by-conflict, not a migration:** The bot needs to exist before its first
solve is recorded, and the cheapest way to guarantee that on every run (cron or local seed)
is an upsert that no-ops once the row exists, rather than a one-time migration step someone
has to remember to run.

```text
INSERT INTO user (id: BOT_USER_ID, name: BOT_NAME, email: reserved non-routable address,
                   emailVerified: true)
ON CONFLICT DO NOTHING
```

## Where the bot's daily solve comes from

Not implemented in this file — see `seedBotSolves` in `dailies.service.ts`. Its target time
per board is `botTimeMs` on `DAILY_BOARDS` (`daily-row.ts`): a hand-tuned "good, beatable"
human time, deliberately well above that board's `minSolveMs` anti-cheat floor.

## Narrative thread for later phases (not built here)

The user has floated Sudoku Bot as a recurring character beyond the leaderboard: a
Clippy-esque tip-giver, and the "teacher" for the planned Phase 7 strategy courses — framed
as "the student has become the master" the first time a player beats it. Also floated: a
small crumbs bonus (Phase 9 economy) for finishing faster than the bot's time on a board.
Neither is built yet; see `Docs/social-progression-economy-plan.md` and the roadmap for where
these are expected to resurface.
