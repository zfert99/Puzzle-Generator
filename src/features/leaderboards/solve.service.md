# Solve Service (`solve.service.ts`)

Recording a ranked daily solve — the anti-cheat core (4.4).

## The two non-negotiable rules

**Why:** A leaderboard people care about invites cheating, so two things are enforced
server-side and never trusted from the client:

1. **Time is server-measured.** The attempt row's `created_at` (set when the user *starts*)
   is the authoritative start; the submit time is the server clock. A client-reported
   duration is ignored entirely.
2. **The grid is verified** against the stored solution before any time is recorded.

Plus a plausibility floor and one ranked attempt per user per puzzle. `userId` is always the
caller's session id (BOLA, 4.3.1) — never from the request.

## `startAttempt(db, userId, puzzleId)`

**Why idempotent, why app-clock `created_at`:** Starting stamps the server-side start time.
`onConflictDoNothing` means a refresh can't reset or extend your timer. `created_at` is set
explicitly from the **app** clock (not the DB's `now()`) so the *same* clock measures both
ends of the solve — mixing app-clock-at-submit with DB-clock-at-start would skew every
recorded time by the app↔DB clock offset (a real bug caught during verification).

## `recordSolve(db, { userId, puzzle, difficulty, submittedGrid, mistakes, now })`

**Why it throws typed `SolveError`s:** Each rejection is an expected 4xx (not a 500), so the
route can map `code`/`status` directly. Order matters: cheap checks first, grid check before
timing.

```text
attempt = the user's row for this puzzle
  none            -> SolveError NOT_STARTED (400)
  already done    -> SolveError ALREADY_COMPLETED (409)
grid != solution  -> SolveError INCORRECT_SOLUTION (400)
timeMs = now - attempt.createdAt
too fast          -> SolveError TOO_FAST (400)
otherwise: mark completed, store timeMs + mistakes, return the row
```
