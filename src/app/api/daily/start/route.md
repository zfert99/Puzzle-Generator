# Daily Start Route (`/api/daily/start`)

`POST /api/daily/start` — records the server-side start time for today's daily.

## Why a separate start call

**Why:** Ranking needs a trustworthy start anchor. The server stamps the start when the player
begins, and the same insert enforces the one-ranked-attempt-per-day lock. Sign-in required
(ranked play); idempotent so a refresh can't restart the timer.

**What the stamp is NOT yet (September 2026 review):** it is recorded but never read at submit —
`recordSolve` ranks on the client's in-game timer per the documented solve-time posture
(`Docs/research/daily-solve-time-trust.md`), so no code currently compares `timeMs` against
wall-clock-since-stamp. The stamp exists so the Phase 9 time-trust gate (checks A + B in that
research doc) has a server-side anchor to build on. This doc used to claim the solve "can be
timed by the server clock", which overstated what the code does.

```text
requireUserId()                        # 401 if signed out
validate difficulty (daily set)        # 400 otherwise
puzzle = today's daily for difficulty  # 404 if the cron hasn't run
startAttempt(userId, puzzle.id)        # stamps created_at, idempotent
-> 200 { puzzleId, startedAt, completed }
```

Node runtime, `force-dynamic`.
