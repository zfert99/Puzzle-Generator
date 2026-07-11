# Leaderboard View (`LeaderboardView.tsx`)

Client view for `/leaderboard`: difficulty tabs, today's board, and (signed in) the caller's
own rank + streak.

## Why fetch effects avoid synchronous setState

**Why:** The `react-hooks/set-state-in-effect` rule (and cascading-render performance) means
setState must not run synchronously in an effect body. So the fetch effects set state only
inside async callbacks, and the loading flash on tab-switch is driven from the click handler
(`selectDifficulty`) instead. The streak render gates on `session`, so signing out needs no
synchronous reset. All ranking/ownership is decided server-side; this is a pure view over
`/api/leaderboard` and `/api/me/streak`.

```text
effect [difficulty] -> GET /api/leaderboard -> setEntries/setMe (async)
effect [session]    -> if signed in, GET /api/me/streak -> setStreak (async)
tab click           -> setLoading(true) + setDifficulty (event handler)
render              -> tabs · (streak · your rank) · table with the caller's row highlighted
```
