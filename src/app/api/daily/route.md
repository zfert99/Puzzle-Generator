# Daily Read Route (`/api/daily`)

`GET /api/daily?difficulty=easy|medium|hard|expert` — returns today's (00:00-UTC) shared
daily puzzle for one difficulty, shaped so the Phase 3 board consumes it directly.

## Why it is a thin controller

**Why:** The route only validates input and delegates to `getDailyPuzzle` in the dailies
service (AGENTS.md §1 — routes are controllers, DB access lives in services). It computes
"today" from the server clock in UTC and forces dynamic rendering so a day-stale response
is never cached.

```text
Read `difficulty` from the query string.
If it is not one of the four daily difficulties -> 400.
Compute today's UTC date.
Ask the service for that day's puzzle.
If none exists yet (cron hasn't run) -> 404 with a clear message.
Otherwise -> 200 { date, difficulty, gridSize: 9, grid, solution, clueCount }.
On any thrown error -> log server-side, return a generic 500 (no stack on the wire).
```

## Why `solution` is included (for now)

**Why:** In 4.2 play is anonymous and **unranked**, and the interactive board needs the
solution locally for mistake highlighting and hints. There is no leaderboard to protect
yet, so serving it is acceptable. **This changes in 4.4:** once solves are ranked, the
solution must no longer be served for an unranked/unsolved daily, and completion is
validated server-side against the stored solution instead (see
`Docs/phase4-implementation-plan.md`, anti-cheat).

Runs on the Node.js runtime (DB driver is Node-only).
