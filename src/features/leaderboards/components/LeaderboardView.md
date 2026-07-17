# Leaderboard View (`LeaderboardView.tsx`)

Client view for the leaderboard: difficulty tabs, a day's board, and (signed in) the caller's
own rank + streak.

## Today vs. a past day (the archive)

Pass `date` (YYYY-MM-DD) to show a **past** day's board (the archive reuses this component);
omit it for today. For a past board the today-relative panels (streak + personal bests) are
hidden — that effect gates on `!date` — while the caller's own historical rank still shows.
Difficulty can also be **controlled** externally (`difficulty` + `onDifficultyChange`) so the
archive drives one selector for both the board and its "Play (practice)" button; uncontrolled
(internal state) by default.

## Why fetch effects avoid synchronous setState

**Why:** The `react-hooks/set-state-in-effect` rule (and cascading-render performance) means
setState must not run synchronously in an effect body. So the fetch effects set state only
inside async callbacks, and the loading flash on tab-switch is driven from the click handler
(`selectDifficulty`) instead. The streak render gates on `session`, so signing out needs no
synchronous reset. All ranking/ownership is decided server-side; this is a pure view over
`/api/leaderboard` and `/api/me/streak`.

```text
effect [difficulty] -> GET /api/leaderboard -> setEntries/setMe (async)
effect [session]    -> if signed in, GET /api/me/streak + /api/me/bests -> setStreak/setBests (async)
tab click           -> setLoading(true) + setDifficulty (event handler)
render              -> tabs · (streak · your rank) · personal bests · table (caller's row highlighted)
```
