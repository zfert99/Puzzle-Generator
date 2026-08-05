# Solve Route (`/api/solve`)

`POST /api/solve` — submit a completed daily for ranking. Sign-in required.

## Why the server owns the truth

**Why:** This is where anti-cheat lives (4.4). The route validates input shape, then hands
off to `recordSolve`, which ranks by the **client-reported** `timeMs` (the in-game timer, so
save & continue is fair), verifies the grid against the stored solution, rejects implausibly
fast times (the guard), and enforces one ranked attempt per user. Expected rejections come
back as typed `SolveError`s → mapped to their 4xx status (not a 500).

```text
requireUserId()                                            # 401 if signed out
validate difficulty + grid (completed 4x4/6x6/9x9)          # 400 otherwise
validate timeMs: finite, 0 <= t <= 24h                      # 400 otherwise
clamp mistakes into [0, 100_000]                            # never rejects
puzzle = today's daily                                      # 404 if missing
recordSolve(userId, puzzle, grid, mistakes, timeMs)  # throws SolveError on rejection
rank = getUserRank(puzzle, userId)
-> 200 { timeMs, mistakes, rank }
SolveError -> its status (400/409); Unauthorized -> 401; else generic 500
```

Node runtime (DB), `force-dynamic`.

## Why `timeMs` has an upper bound, and `mistakes` doesn't reject

**Why:** `time_ms` is a Postgres `integer`. The route used to check only that the submitted
time was finite and non-negative — so a `timeMs` of `1e12` passed validation, sailed through
the plausibility floor (which by construction only rejects times that are too **small**),
reached the UPDATE, and failed at the driver with "value out of range for type integer". An
input the route had already accepted came back as an unhandled 500 with a stack in the logs.

The ceiling is **24 hours**, chosen from the domain rather than from int4: only *today's* daily
is rankable (`DailyExperience` drops a submission once the board's `dailyDate` is no longer
today) and the timer only advances while actively playing, so no genuine solve can exceed a
day. That is far tighter than the column limit, which is the point — a bound that means
something rejects more garbage than one that merely avoids a crash.

**`mistakes` is clamped, not rejected**, because it is cosmetic — it never affects ranking, so
failing an otherwise-valid solve over a display stat would be the worse outcome. It shares the
same int4 column, though, so it cannot be passed through raw either.
`recordSolve` clamps both again as a last-resort column guard for any non-route caller (see
[solve.service.md](../../../features/leaderboards/solve.service.md)).

## Bug: mini dailies couldn't complete (fixed July 2026)

`isCompletedGrid` used to hardcode a 9×9 shape with digits 1–9 — the daily registry's minis
(4×4/6×6 boards, `mini4-*`/`mini6-*`/`killer6-*`) submit a smaller grid, so every mini solve
was rejected with a 400 before it ever reached `recordSolve`'s solution check. The client's
local win-detection still fired ("Daily Solved!"), so the player saw a false success — but
nothing was recorded, so the solve never appeared on the leaderboard or in the dailies
"completed" list. Fixed by validating against any of this app's actual `GridSize`s (4, 6, 9)
instead of a hardcoded 9, with the digit range following the grid's own size. `gridsMatch`
(`solve-rules.ts`) and the plausibility floor were already size-agnostic — this route-level shape
check was the only place still assuming every daily is 9×9. (The floor was then keyed on
`(variant, size, difficulty)` outright by the daily restructure — see `solve-rules.md`.)
