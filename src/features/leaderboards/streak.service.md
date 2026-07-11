# Streak Service (`streak.service.ts`)

Fetches a user's completed-daily dates and delegates to the pure `currentStreak` helper.

## Why this split

**Why:** The DB half is trivial (a scoped join); the hard part — consecutive-day arithmetic
— lives in the pure [streak.ts](./streak.md) so it is unit-tested without a database. Scoped
to the caller (`WHERE user_id = userId`, BOLA).

```text
SELECT daily_puzzles.date
  FROM solve_attempts JOIN daily_puzzles
  WHERE user_id = userId AND completed
-> currentStreak(those dates, today)
```
