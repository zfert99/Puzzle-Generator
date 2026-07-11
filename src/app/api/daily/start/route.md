# Daily Start Route (`/api/daily/start`)

`POST /api/daily/start` — records the server-side start time for today's daily.

## Why a separate start call

**Why:** Ranking needs a trustworthy start time. Rather than trust the browser (which can
lie), the server stamps the start when the player begins, so a later `/api/solve` can be
timed by the server clock. Sign-in required (ranked play); idempotent so a refresh can't
restart the timer.

```text
requireUserId()                        # 401 if signed out
validate difficulty (daily set)        # 400 otherwise
puzzle = today's daily for difficulty  # 404 if the cron hasn't run
startAttempt(userId, puzzle.id)        # stamps created_at, idempotent
-> 200 { puzzleId, startedAt, completed }
```

Node runtime, `force-dynamic`.
