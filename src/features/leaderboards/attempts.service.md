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

## Note

Writes (recording a *verified* solve) arrive in 4.4 and follow the same rule: the `userId`
is server-supplied, and `UNIQUE(user_id, puzzle_id)` caps one ranked attempt per user per
puzzle. The unit tests capture the `.where()` filter and assert it is the user-id predicate,
so dropping the ownership filter fails the build.
