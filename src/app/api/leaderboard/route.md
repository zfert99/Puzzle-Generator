# Leaderboard Route (`/api/leaderboard`)

`GET /api/leaderboard?difficulty=…&date=YYYY-MM-DD` — a day's board for one difficulty.

## Why public, with an optional self-rank

**Why:** Anyone can view the board (viewable signed out), so this returns the top entries
unconditionally. If the caller is signed in, their own rank is added — derived from the
session id, never a query param (BOLA). `date` defaults to today (UTC) so the common case
needs no argument.

```text
validate difficulty (daily set)   # 400 otherwise
isoDate = date param or today; validate YYYY-MM-DD   # 400 otherwise
puzzle = daily for (isoDate, difficulty)  # 404 if missing
entries = getLeaderboard(puzzle)          # top N, public
me = signed in ? getUserRank(puzzle, sessionUserId) : null
-> 200 { date, difficulty, entries, me }
```

Node runtime (DB), `force-dynamic`.
