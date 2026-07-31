# Attempts Service (`attempts.service.ts`)

Ownership-scoped reads of a user's solve attempts — the data-access half of the BOLA
defense (AGENTS.md §6, slice 4.3.1).

## Why every function demands a `userId`

**Why:** The #1 AI pitfall AGENTS.md calls out is verifying *authentication* but not
*ownership*. So these functions structurally cannot leak another user's data: each takes a
`userId` and applies it as a `WHERE user_id = userId` predicate **in the query**, not in app
code after a broad fetch. There is deliberately **no** `getAttemptById()` that would let a
route return a row without proving ownership. Callers pass the id from `requireUserId()` (the
session), never one taken from the request — so a caller can only ever read their own rows.

## `getUserAttempts(db, userId)`

**Why:** Backs "my attempts / my stats" (and the 4.4 personal-bests view). Scoped to the
caller, newest first.

```text
SELECT * FROM solve_attempts WHERE user_id = userId ORDER BY created_at DESC
```

## `getUserAttemptForPuzzle(db, userId, puzzleId)`

**Why:** Answers "has this user already solved this puzzle?" — needed before 4.4 records a
ranked attempt (one per user per puzzle). Compound filter on both ids.

```text
SELECT * FROM solve_attempts WHERE user_id = userId AND puzzle_id = puzzleId LIMIT 1  (or null)
```

## `getTodayCompletions(db, userId, isoDate)`

**Why:** A daily is one attempt per day, so the UI needs to know which of today's difficulties
the user already finished (to show "solved — come back tomorrow" instead of a replay button).
Scoped to `userId` + `completed` + today's date via a join to `daily_puzzles`.

```text
SELECT difficulty, puzzle_id, time_ms
  FROM solve_attempts JOIN daily_puzzles
  WHERE user_id = userId AND completed AND date = isoDate
```

## `getPersonalBests(db, userId)`

**Why:** Backs the "your personal bests" view — the user's fastest completed time per board across
all days. Scoped to `userId` and `completed`, grouped via a join to `daily_puzzles`.

```text
SELECT daily_puzzles.difficulty, daily_puzzles.variant, MIN(time_ms)
  FROM solve_attempts JOIN daily_puzzles
  WHERE user_id = userId AND completed
  GROUP BY difficulty, variant
```

**Why grouped by `(difficulty, variant)`, not difficulty alone (daily restructure Risk #4).** This
is the one genuinely **cross-date** aggregate, so it is the query the type-as-slot model can break:
a rung key like `hard` means Classic one day and Killer the next, and grouping by the key alone
would collapse those into a single meaningless "best hard". Including the stored `variant` keeps
bests type-attributable and stays correct at the 5-type end state. Historical rows slot in cleanly —
migration `0004` backfilled every one, so old classic-only `hard` rows group under `(hard, classic)`.

The sibling aggregates were checked against the same risk: `getTodayCompletions` is single-date (a
key is unambiguous within one day) and `getCurrentStreak` only counts distinct completed dates, so
neither is key-sensitive.

## Note

Writes (recording a *verified* solve) live in the solve service (4.4) and follow the same
rule: the `userId` is server-supplied, and `UNIQUE(user_id, puzzle_id)` caps one ranked
attempt per user per puzzle. The unit tests capture the `.where()` filter and assert it is the
user-id predicate, so dropping the ownership filter fails the build.
