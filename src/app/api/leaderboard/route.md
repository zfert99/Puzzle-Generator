# Leaderboard Route (`/api/leaderboard`)

`GET /api/leaderboard?difficulty=…&date=YYYY-MM-DD` — a day's board for one difficulty.

## Why public, with an optional self-rank

**Why:** Anyone can view the board (viewable signed out), so this returns the top entries
unconditionally. If the caller is signed in, their own rank is added — derived from the
session id, never a query param (BOLA). `date` defaults to today (UTC) so the common case
needs no argument.

```text
validate difficulty (daily set)   # 400 otherwise
isoDate = date param or today; validate it is a REAL date (isIsoDate)   # 400 otherwise
puzzle = daily for (isoDate, difficulty)  # 404 if missing
sessionUserId = getCurrentUserId()        # BEFORE the board: it decides `isMe`
entries = getLeaderboard(puzzle, sessionUserId)   # top N, public, NO user ids
me = signed in ? getUserRank(puzzle, sessionUserId) : null
-> 200 { date, difficulty, entries, me }
```

Node runtime (DB), `force-dynamic`.

## Why the session is read before the board is built

**Why:** entries carry no `userId` — this endpoint is unauthenticated, so shipping every player's
better-auth account id made it world-readable for the sake of two booleans the client derived from
it ("is this row me?", "is this the bot?"). Both are now set server-side, which means
`getLeaderboard` needs the viewer's id as an *input*, so `getCurrentUserId()` moved above it.

That id is the session's, never a query parameter — a request-supplied one would let a caller ask
which row belongs to somebody else, and a route test pins that by passing `?userId=` and asserting
the session id is used anyway. See
[leaderboard.service.md](../../../features/leaderboards/leaderboard.service.md).

## Why the date check asks whether the date *exists*

**Why:** The check used to be `/^\d{4}-\d{2}-\d{2}$/`, which validates shape, not existence.
`2026-02-31` matched, was compared against a Postgres `date`, and the driver threw — an
unhandled 500 (with a stack in the logs) from an input this route had already accepted. Shape
and existence are different questions, and only the second one keeps the query safe; the guard
lives in [`isIsoDate`](../../../lib/db/daily-row.md) so all three date-taking routes share it.

This route was the worst affected of the three. The other two also compare `isoDate > todayIso`
to reject future dates, which incidentally caught a `9999-99-99` before it reached the query.
This one has no future check, so nothing stood between a well-formed non-date and the driver.

Rejection is 400, and a *real* date with no puzzles is still a 404 — "not a date" and "no board
that day" are different answers and must not collapse into one.
