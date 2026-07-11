# My Attempts Route (`/api/me/attempts`)

`GET /api/me/attempts` — the caller's own solve attempts. The BOLA reference
implementation (AGENTS.md §6, 4.3.1).

## Why this is the ownership pattern in miniature

**Why:** Identity comes from `requireUserId()` — the *session* — and is passed to a data
accessor that filters by it. There is **no `?userId=`** and the body is ignored: a caller
cannot request another user's data because the id is never taken from the request. Every
future personal-data route (4.4 "my rank", "my streak") follows this exact shape.

```text
userId = requireUserId()            # from the session; throws UnauthorizedError if signed out
attempts = getUserAttempts(db, userId)   # WHERE user_id = userId
-> 200 { attempts }

On UnauthorizedError -> 401 (not signed in)
On any other error   -> log server-side, generic 500 (no details on the wire)
```

## Note

`runtime = "nodejs"` (DB driver + session are Node-only) and `dynamic = "force-dynamic"`
(per-user, never cached). Verified end-to-end: 401 unauthenticated, and two users each saw
only their own attempt on the same puzzle.
