# My Streak Route (`/api/me/streak`)

`GET /api/me/streak` — the caller's current daily streak (consecutive UTC days completed).

## Why

**Why:** Sign-in required and scoped to the session user (BOLA) — there is no `?userId=`.
Delegates to the streak service, which counts consecutive completed days ending today or
(grace) yesterday.

```text
requireUserId()                     # 401 if signed out
streak = getCurrentStreak(userId, today UTC)
-> 200 { streak }
```

Node runtime (DB), `force-dynamic`.
