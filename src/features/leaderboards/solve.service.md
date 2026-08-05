# Solve Service (`solve.service.ts`)

Recording a ranked daily solve — the anti-cheat core (4.4).

## Timing model and the guards

**Why client-timed:** Ranking uses the **client's in-game timer** (`clientTimeMs`), which only
advances while the player is actively on the board. This is a deliberate, pragmatic tradeoff
that enables **save & continue**: a player can leave a daily and resume later without their
away-time inflating their rank. A client-reported time is less trustworthy than a
server-measured one, so the **plausibility floor** (`isImplausiblyFast`) is the guard that
stays — anything below the human-possible minimum for that difficulty is rejected. For a
casual portfolio leaderboard, that's an acceptable trade (see the security-tradeoff stance).

**Always enforced regardless:**

- **The grid is verified** against the stored solution before any time is recorded.
- **One ranked attempt** per user per puzzle — see "Why the UPDATE is conditional" below for
  which guard actually does this (it is not the unique index alone).
- `userId` is always the caller's session id (BOLA, 4.3.1) — never from the request.

`startAttempt` still records the attempt row (the one-per-day lock + the `NOT_STARTED`
marker); its `created_at` is no longer used for timing.

## `startAttempt(db, userId, puzzleId)`

**Why idempotent, why app-clock `created_at`:** Starting stamps the server-side start time.
`onConflictDoNothing` means a refresh can't reset or extend your timer. `created_at` is set
explicitly from the **app** clock (not the DB's `now()`) so the *same* clock measures both
ends of the solve — mixing app-clock-at-submit with DB-clock-at-start would skew every
recorded time by the app↔DB clock offset (a real bug caught during verification).

## `recordSolve(db, { userId, puzzle, submittedGrid, mistakes, clientTimeMs })`

**Why no `difficulty` argument any more (daily restructure Step 3b):** it was only ever used to look
up the plausibility floor. The floor now comes from the puzzle's own stored `(variant, grid size,
difficulty)` — a rung key like `hard` holds a different type/size each day, so the key alone can't
identify the right floor. `puzzle` already carries everything needed, so the redundant (and now
misleading) parameter is gone.

**Why it throws typed `SolveError`s:** Each rejection is an expected 4xx (not a 500), so the
route can map `code`/`status` directly. Order matters: cheap checks first, grid check before
timing.

```text
attempt = the user's row for this puzzle
  none            -> SolveError NOT_STARTED (400)
  already done    -> SolveError ALREADY_COMPLETED (409)   # cheap early rejection only
grid != solution  -> SolveError INCORRECT_SOLUTION (400)
timeMs = clampToColumn(clientTimeMs)   # the client's in-game timer, pinned to int4
too fast          -> SolveError TOO_FAST (400)   # plausibility floor = the guard
UPDATE ... WHERE user = u AND puzzle = p AND completed = false
  no row matched  -> SolveError ALREADY_COMPLETED (409)   # lost a race
otherwise: return the updated row
```

## Why the UPDATE is conditional (`completed = false` in the WHERE)

**Why:** Because the `attempt.completed` read above it is **not** what enforces one ranked
attempt — it cannot be. The read and the write are two separate round-trips with nothing
between them: the driver is `neon-http`, which is stateless and offers no interactive
transaction (the same constraint documented in `dailies.service.ts` for the cron's idempotency
guard).

So two submissions racing each other both read `completed = false`, both passed the grid and
floor checks, and both wrote — letting a concurrent double-submit keep the better of two
claimed times, against the very invariant this service exists to hold. The unique index does
not help here: it caps one attempt **row** per `(user, puzzle)` and says nothing about the
`completed` transition, which is the thing being raced.

Putting the predicate in the UPDATE's own WHERE makes it a single atomic statement, so exactly
one racer matches a row. The early read stays because it is cheap, distinguishes `NOT_STARTED`,
and avoids a pointless write on the common replay path — but it is an optimization now, not the
guard. `.returning()` yielding nothing means another request got there first, which is reported
as the same 409 a sequential replay gets: a caller cannot tell the two apart, and shouldn't.

**Gotcha this also closed:** an unmatched UPDATE previously left `updated` as `undefined`, and
the route's `attempt.timeMs` then threw a `TypeError` — a 500 where the caller should have seen
a clean 409.

## Why writes clamp to int4 (`clampToColumn`)

**Why:** `time_ms` and `mistakes` are Postgres `integer` columns carrying **client-supplied**
numbers. A value above 2,147,483,647 is not a validation failure but a *driver* error raised
mid-UPDATE, so it bypasses the typed-`SolveError` path entirely and surfaces as an unhandled
500. The plausibility floor is no help: it only rejects times that are too **small**.

The route rejects an out-of-range `timeMs` with a 400 before reaching here (a garbage time
should fail loudly, not be quietly recorded at the bottom of the leaderboard). `clampToColumn`
is the last-resort guard for any other caller — pin the value rather than let the statement
blow up. It also truncates fractional milliseconds, which an integer column would reject.
