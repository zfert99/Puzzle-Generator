# My Today Route (`/api/me/today`)

`GET /api/me/today` — which of today's dailies the caller has already completed, with time
and rank.

## Why

**Why:** A daily is one attempt per day, so the UI needs to know which difficulties the user
already finished today to show a "solved — come back tomorrow" state instead of a replay
button. Sign-in required; scoped to the session user (BOLA).

```text
requireUserId()                          # 401 if signed out
completions = getTodayCompletions(userId, todayUTC)   # WHERE user_id + completed + date
for each: attach rank via getUserRank
-> 200 { completed: { [difficulty]: { timeMs, rank } } }
```

Node runtime (DB), `force-dynamic`.
