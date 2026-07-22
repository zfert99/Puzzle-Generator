# Daily Read Route (`/api/daily`)

`GET /api/daily?difficulty=…&date=YYYY-MM-DD` — returns a shared daily puzzle for one
difficulty, shaped so the board consumes it directly. `date` defaults to today (00:00-UTC); a
past date serves that day's puzzle for the **archive** (unranked replay). Future dates → 400.

## Why it is a thin controller

**Why:** The route only validates input and delegates to `getDailyPuzzle` in the dailies
service (AGENTS.md §1 — routes are controllers, DB access lives in services). It computes
"today" from the server clock in UTC and forces dynamic rendering so a day-stale response
is never cached.

```text
Read `difficulty` + optional `date` from the query string.
If difficulty is not a daily difficulty -> 400.
isoDate = date ?? today's UTC date; if malformed -> 400; if in the future -> 400.
Ask the service for that day's puzzle.
If none exists yet (cron hasn't run / no puzzle for that day) -> 404 with a clear message.
Otherwise -> 200 { date, difficulty, gridSize: 9, grid, solution, clueCount }.
On any thrown error -> log server-side, return a generic 500 (no stack on the wire).
```

## Why `solution` is included (for now)

**Why:** In 4.2 play is anonymous and **unranked**, and the interactive board needs the
solution locally for mistake highlighting and hints. There is no leaderboard to protect
yet, so serving it is acceptable. **This changes in 4.4:** once solves are ranked, the
solution must no longer be served for an unranked/unsolved daily, and completion is
validated server-side against the stored solution instead (see
`Docs/archive/phase4-implementation-plan.md`, anti-cheat).

Runs on the Node.js runtime (DB driver is Node-only).

## Killer dailies

When the fetched row has cages (difficulty `'killer'`), the response additionally includes
`variant: 'killer'` and `cages`, which is all `startNewGame` needs to start it as a Killer
board. Everything else — validation, anti-cheat posture, archive dates — is unchanged.

Accepts any daily-board key (plus legacy `'killer'`); `gridSize` in the response derives from
the stored grid's length, so mini boards need no schema change.
