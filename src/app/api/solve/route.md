# Solve Route (`/api/solve`)

`POST /api/solve` — submit a completed daily for ranking. Sign-in required.

## Why the server owns the truth

**Why:** This is where anti-cheat lives (4.4). The route validates input shape, then hands
off to `recordSolve`, which ranks by the **client-reported** `timeMs` (the in-game timer, so
save & continue is fair), verifies the grid against the stored solution, rejects implausibly
fast times (the guard), and enforces one ranked attempt per user. Expected rejections come
back as typed `SolveError`s → mapped to their 4xx status (not a 500).

```text
requireUserId()                                      # 401 if signed out
validate difficulty + grid (completed 9x9) + timeMs  # 400 otherwise
puzzle = today's daily                               # 404 if missing
recordSolve(userId, puzzle, grid, mistakes, timeMs)  # throws SolveError on rejection
rank = getUserRank(puzzle, userId)
-> 200 { timeMs, mistakes, rank }
SolveError -> its status (400/409); Unauthorized -> 401; else generic 500
```

Node runtime (DB), `force-dynamic`.
