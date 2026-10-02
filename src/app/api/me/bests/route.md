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

Node runtime (DB), `force-dynamic`. Never publicly cached — the body is the caller's own data.

## Tests

`route.test.ts` (session, DB client, `attempts.service` and logger mocked at the boundary) calls the
handler with a `?userId=someone-else` request and asserts the query received only the **session**
id, and that a signed-out request is a `401` that never reaches the query. The handler takes no
request parameter at all — the tests call it with one anyway, so a future signature that starts
reading the query string is caught.
