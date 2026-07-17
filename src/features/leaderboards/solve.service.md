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
- **One ranked attempt** per user per puzzle (`UNIQUE(user_id, puzzle_id)`).
- `userId` is always the caller's session id (BOLA, 4.3.1) — never from the request.

`startAttempt` still records the attempt row (the one-per-day lock + the `NOT_STARTED`
marker); its `created_at` is no longer used for timing.

## `startAttempt(db, userId, puzzleId)`

**Why idempotent, why app-clock `created_at`:** Starting stamps the server-side start time.
`onConflictDoNothing` means a refresh can't reset or extend your timer. `created_at` is set
explicitly from the **app** clock (not the DB's `now()`) so the *same* clock measures both
ends of the solve — mixing app-clock-at-submit with DB-clock-at-start would skew every
recorded time by the app↔DB clock offset (a real bug caught during verification).

## `recordSolve(db, { userId, puzzle, difficulty, submittedGrid, mistakes, clientTimeMs })`

**Why it throws typed `SolveError`s:** Each rejection is an expected 4xx (not a 500), so the
route can map `code`/`status` directly. Order matters: cheap checks first, grid check before
timing.

```text
attempt = the user's row for this puzzle
  none            -> SolveError NOT_STARTED (400)
  already done    -> SolveError ALREADY_COMPLETED (409)
grid != solution  -> SolveError INCORRECT_SOLUTION (400)
timeMs = max(0, trunc(clientTimeMs))   # the client's in-game timer
too fast          -> SolveError TOO_FAST (400)   # plausibility floor = the guard
otherwise: mark completed, store timeMs + mistakes, return the row
```
