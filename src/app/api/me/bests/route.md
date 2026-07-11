# My Bests Route (`/api/me/bests`)

`GET /api/me/bests` — the caller's all-time best time per difficulty.

## Why

**Why:** Sign-in required and scoped to the session user (BOLA) — no `?userId=`. Delegates to
`getPersonalBests`, which takes the min completed `time_ms` per difficulty across all days.

```text
requireUserId()                 # 401 if signed out
bests = getPersonalBests(userId)
-> 200 { bests: [{ difficulty, bestMs }] }
```

Node runtime (DB), `force-dynamic`.
