# Solve Route (`/api/solve`)

`POST /api/solve` — submit a completed daily for ranking. Sign-in required.

## Why the server owns the truth

**Why:** This is where anti-cheat lives (4.4). The route validates input shape, then hands
off to `recordSolve`, which computes the time from the server clock (start recorded by
`/api/daily/start`), verifies the grid against the stored solution, rejects implausibly fast
times, and enforces one ranked attempt per user. Expected rejections come back as typed
`SolveError`s → mapped to their 4xx status (not a 500).

```text
requireUserId()                                   # 401 if signed out
validate difficulty + grid is a completed 9x9     # 400 otherwise
puzzle = today's daily                            # 404 if missing
recordSolve(userId, puzzle, grid, mistakes, now)  # throws SolveError on rejection
rank = getUserRank(puzzle, userId)
-> 200 { timeMs, mistakes, rank }
SolveError -> its status (400/409); Unauthorized -> 401; else generic 500
```

Node runtime (DB), `force-dynamic`.
